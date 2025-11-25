import { Account, AccountType, Book, Transaction, Group } from "bkper-js";
import { EXC_CODE_PROP, EXC_RATE_PROP, EXC_LOG_PROP, EXC_AMOUNT_PROP } from "./constants.js";
import { EventHandlerTransaction } from "./EventHandlerTransaction.js";
import { AppContext } from "./AppContext.js";

export abstract class EventHandlerTransactionEvent extends EventHandlerTransaction {
    constructor(context: AppContext) {
        super(context);
    }

    protected getTransactionQuery(transaction: bkper.Transaction): string {
        return `remoteId:${transaction.id}`;
    }

    protected async mirrorTransaction(baseBook: Book, connectedBook: Book, transaction: bkper.Transaction): Promise<Transaction> {

        let baseCode = this.botService.getBaseCode(baseBook);
        let baseCreditAccount = transaction.creditAccount;
        let baseDebitAccount = transaction.debitAccount;
        let connectedCode = this.botService.getBaseCode(connectedBook);

        let connectedCreditDebitAccounts = await Promise.all([connectedBook.getAccount(baseCreditAccount.name), connectedBook.getAccount(baseDebitAccount.name)])

        let connectedCreditAccount = connectedCreditDebitAccounts[0];
        if (connectedCreditAccount == null) {
            try {
                connectedCreditAccount = await this.createAccount(connectedBook, baseCreditAccount);
            } catch (err) {
                //OK
            }
        }
        let connectedDebitAccount = connectedCreditDebitAccounts[1];
        if (connectedDebitAccount == null) {
            try {
                connectedDebitAccount = await this.createAccount(connectedBook, baseDebitAccount);
            } catch (err) {
                //OK
            }
        }

        let amountDescription = await super.extractAmountDescription_(baseBook, connectedBook, baseCode, connectedCode, transaction);

        if (amountDescription.amount == null) {
            throw `Exchange rate NOT found for code  ${connectedCode} on ${transaction.date}`;
        }

        if (amountDescription.amount.eq(0)) {
            return null;
        }

        const creditDebitAccounts = await Promise.all([connectedBook.getAccount(baseCreditAccount.name), connectedBook.getAccount(baseDebitAccount.name)])

        let newTransaction = new Transaction(connectedBook)
            .setDate(transaction.date)
            .setVisibleProperties(transaction.properties)
            .setAmount(amountDescription.amount)
            .setCreditAccount(creditDebitAccounts[0])
            .setDebitAccount(creditDebitAccounts[1])
            .setDescription(amountDescription.description)
            .addRemoteId(transaction.id)
            .setChecked(transaction.checked)
            ;

        if (amountDescription.excBaseCode) {
            // Exchange code prop
            newTransaction.setProperty(EXC_CODE_PROP, amountDescription.excBaseCode);
        }

        if (amountDescription.excBaseRate) {
            // Exchange rate prop
            newTransaction.setProperty(EXC_RATE_PROP, amountDescription.excBaseRate.toString());
            // Exchange amount prop
            if (transaction.amount) {
                newTransaction.setProperty(EXC_AMOUNT_PROP, transaction.amount);
            }
        }

        if (amountDescription.rates) {
            const excLogEntries = await this.buildExcLog(baseBook, connectedBook, transaction, amountDescription);
            if (excLogEntries.length > 0) {
                newTransaction.setProperty(EXC_LOG_PROP, JSON.stringify(excLogEntries));
            }
        }

        if (this.isReadyToPost(newTransaction.json())) {
            await newTransaction.post();
        } else {
            newTransaction.setDescription(`${newTransaction.getCreditAccount() == null ? baseCreditAccount.name : ''} ${newTransaction.getDebitAccount() == null ? baseDebitAccount.name : ''} ${newTransaction.getDescription()}`.trim())
            await newTransaction.create();
        }

        return newTransaction;
    }

    protected isReadyToPost(newTransaction: bkper.Transaction) {
        return newTransaction.creditAccount != null && newTransaction.debitAccount != null && newTransaction.amount != null;
    }

    protected async createAccount(connectedBook: Book, baseAccount: bkper.Account): Promise<Account> {
        let newConnectedAccount = new Account(connectedBook)
            .setName(baseAccount.name)
            .setType(baseAccount.type as AccountType)
            .setVisibleProperties(baseAccount.properties);
        const baseGroups = baseAccount.groups;
        if (baseGroups) {
            for (const baseGroup of baseGroups) {
                let connectedGroup = await connectedBook.getGroup(baseGroup.name);
                if (connectedGroup == null) {
                    let newGroup = new Group(connectedBook);
                    connectedGroup = await newGroup.setName(baseGroup.name).setVisibleProperties(baseGroup.properties).create();
                }
                newConnectedAccount.addGroup(connectedGroup);
            }
        }
        await newConnectedAccount.create();
        return newConnectedAccount;
    }

}
