import { Amount, Book, Transaction } from "bkper-js";
import { extractAmountDescription_, getBaseCode, getRatesEndpointConfig, hasBaseBookInCollection, isBaseBook, getAccountExcCode, match } from "./BotService.js";
import { EXC_AMOUNT_PROP } from "./constants.js";
import { EventHandler } from "./EventHandler.js";
import { ExchangeRates } from "./ExchangeRates.js";
import { convertBase } from "./exchange-service.js";

export interface AmountDescription {
    amount: Amount;
    description: string;
    excBaseCode: string;
    excBaseRate?: Amount;
    rates?: ExchangeRates;
}

export interface ExcLogEntry {
    exc_code: string,
    exc_rate: string
}

export abstract class EventHandlerTransaction extends EventHandler {

    async processObject(baseBook: Book, connectedBook: Book, event: bkper.Event): Promise<string> {

        let operation = event.data.object as bkper.TransactionOperation;
        let transaction = operation.transaction;

        if (transaction.agentId == 'exchange-bot' && event.type != 'TRANSACTION_DELETED') {
            console.log("Same payload agent. Preventing bot loop.");
            return null;
        }

        if (!transaction.posted) {
            return null;
        }

        let connectedCode = getBaseCode(connectedBook);

        let ret: Promise<string> = null;

        if (isBaseBook(connectedBook) || !hasBaseBookInCollection(baseBook) || match(baseBook, connectedCode, transaction)) {
            if (connectedCode != null && connectedCode != '') {
                let iterator = connectedBook.getTransactions(this.getTransactionQuery(transaction));
                if (await iterator.hasNext()) {
                    let connectedTransaction = await iterator.next();
                    ret = this.connectedTransactionFound(baseBook, connectedBook, transaction, connectedTransaction);
                } else {
                    ret = this.connectedTransactionNotFound(baseBook, connectedBook, transaction)
                    if (!ret && transaction.remoteIds && event.type == 'TRANSACTION_DELETED') {
                        for (const remoteId of transaction.remoteIds) {
                            let connectedTransaction = await connectedBook.getTransaction(remoteId);
                            if (connectedTransaction) {
                                ret = this.connectedTransactionFound(connectedBook, baseBook, transaction, connectedTransaction);
                            }
                        }
                    }
                }
            }
        }

        return ret;
    }

    protected async extractAmountDescription_(baseBook: Book, connectedBook: Book, baseCode: string, connectedCode: string, transaction: bkper.Transaction): Promise<AmountDescription> {

        let ratesEndpointConfig = getRatesEndpointConfig(connectedBook, transaction);

        return await extractAmountDescription_(baseBook, connectedBook, baseCode, connectedCode, transaction, ratesEndpointConfig.url)
    }

    protected abstract getTransactionQuery(transaction: bkper.Transaction): string;

    protected abstract connectedTransactionNotFound(baseBook: Book, connectedBook: Book, transaction: bkper.Transaction): Promise<string>;

    protected abstract connectedTransactionFound(baseBook: Book, connectedBook: Book, transaction: bkper.Transaction, connectedTransaction: Transaction): Promise<string>;

    protected async buildExcLog(baseBook: Book, connectedBook: Book, transaction: bkper.Transaction, amountDescription: AmountDescription): Promise<ExcLogEntry[]> {
        const creditAccountCode = await getAccountExcCode(baseBook, transaction.creditAccount);
        const debitAccountCode = await getAccountExcCode(baseBook, transaction.debitAccount);
        let connectedCode = getBaseCode(connectedBook);
        let excLogEntries: ExcLogEntry[] = [];
        if (creditAccountCode && debitAccountCode) {
            if (connectedCode != creditAccountCode && connectedCode != debitAccountCode && creditAccountCode != debitAccountCode) {
                let creditCurrencyEntry: ExcLogEntry = {
                    exc_code: creditAccountCode,
                    exc_rate: amountDescription.excBaseRate.toString()
                }
                const debitCodeRate = this.getDebitCodeRate(connectedBook, transaction, amountDescription, debitAccountCode, connectedCode);
                let debitCurrencyEntry: ExcLogEntry = {
                    exc_code: debitAccountCode,
                    exc_rate: debitCodeRate.toString()
                }
                excLogEntries.push(creditCurrencyEntry);
                excLogEntries.push(debitCurrencyEntry);
            }
        }
        return excLogEntries;
    }

    private getDebitCodeRate(connectedBook: Book, transaction: bkper.Transaction, amountDescription: AmountDescription, debitAccountCode: string, connectedCode: string): Amount {
        if (transaction.properties[EXC_AMOUNT_PROP]) {
            return amountDescription.amount.div(transaction.properties[EXC_AMOUNT_PROP]);
        }
        let parts = amountDescription.description.split(' ');
        for (const part of parts) {
            if (part.startsWith(debitAccountCode)) {
                try {
                    const amount = connectedBook.parseValue(part.replace(debitAccountCode, ''));
                    if (amount) {
                        return amountDescription.amount.div(amount);
                    }
                } catch (error) {
                    continue;
                }
            }
        }
        return new Amount(convertBase(amountDescription.rates, debitAccountCode).rates[connectedCode]);
    }
}
