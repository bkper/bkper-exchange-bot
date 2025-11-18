import { Account, Book, Transaction } from "bkper-js";
import { getBaseCode } from "./BotService.js";
import { EXC_CODE_PROP, EXC_RATE_PROP, EXC_LOG_PROP, EXC_AMOUNT_PROP } from "./constants.js";
import { AmountDescription, EventHandlerTransaction } from "./EventHandlerTransaction.js";
import { EventHandlerTransactionEvent } from './EventHandlerTransactionEvent.js';

export class EventHandlerTransactionUpdated extends EventHandlerTransactionEvent {

  protected getTransactionQuery(transaction: bkper.Transaction): string {
    return `remoteId:${transaction.id}`;
  }

  protected async connectedTransactionNotFound(baseBook: Book, connectedBook: Book, baseTransaction: bkper.Transaction): Promise<string> {

    const timeTagWrite = `Posted not found. [Book ${connectedBook.getName()}] [Owner ${connectedBook.getOwnerName()}] ${Math.random()}`;
    console.time(timeTagWrite);

    let newTransaction = await super.mirrorTransaction(baseBook, connectedBook, baseTransaction);
    console.timeEnd(timeTagWrite);

    return newTransaction ? `${super.buildBookAnchor(connectedBook)}: ${newTransaction.getDate()} ${newTransaction.getAmount()} ${newTransaction.getDescription()}` : null;
  }

  protected async connectedTransactionFound(baseBook: Book, connectedBook: Book, baseTransaction: bkper.Transaction, connectedTransaction: Transaction): Promise<string> {

    const timeTag = `Updated found ${Math.random()}`
    console.time(timeTag)

    let baseCreditAccount = await baseBook.getAccount(baseTransaction.creditAccount.id);
    let baseDebitAccount = await baseBook.getAccount(baseTransaction.debitAccount.id);
    let baseCode = getBaseCode(baseBook);
    let connectedCode = getBaseCode(connectedBook);

    let connectedCreditAccount = await connectedBook.getAccount(baseCreditAccount.getName());
    if (connectedCreditAccount == null) {
      try {
        connectedCreditAccount = await new Account(connectedBook).setName(baseCreditAccount.getName()).create();
      } catch (err) {
        //OK
      }
    }
    let connectedDebitAccount = await connectedBook.getAccount(baseDebitAccount.getName());
    if (connectedDebitAccount == null) {
      try {
        connectedDebitAccount = await new Account(connectedBook).setName(baseDebitAccount.getName()).create();
      } catch (err) {
        //OK
      }
    }

    let amountDescription = await super.extractAmountDescription_(baseBook, connectedBook, baseCode, connectedCode, baseTransaction);

    let amountFormatted = connectedBook.formatValue(connectedTransaction.getAmount())

    if (amountDescription.amount.eq(0)) {
      if (connectedTransaction.isChecked()) {
        await connectedTransaction.uncheck();
      }
      await connectedTransaction.trash();
      console.timeEnd(timeTag)
      let record = `DELETED: ${connectedTransaction.getDateFormatted()} ${amountFormatted} ${await connectedTransaction.getCreditAccountName()} ${await connectedTransaction.getDebitAccountName()} ${connectedTransaction.getDescription()}`;
      return record
    }

    let bookAnchor = super.buildBookAnchor(connectedBook);

    await this.updateConnectedTransaction(baseBook, connectedBook, connectedTransaction, amountDescription, baseTransaction, connectedCreditAccount, connectedDebitAccount);

    let record = `EDITED: ${connectedTransaction.getDateFormatted()} ${connectedBook.formatValue(connectedTransaction.getAmount())}  ${await connectedTransaction.getCreditAccountName()} ${await connectedTransaction.getDebitAccountName()} ${connectedTransaction.getDescription()}`;

    console.timeEnd(timeTag)

    return `${bookAnchor}: ${record}`;
  }



  private async updateConnectedTransaction(baseBook: Book, connectedBook: Book, connectedTransaction: Transaction, amountDescription: AmountDescription, transaction: bkper.Transaction, connectedCreditAccount: Account, connectedDebitAccount: Account) {

    if (connectedTransaction.isChecked()) {
      await connectedTransaction.uncheck();
    }

    connectedTransaction.setAmount(amountDescription.amount)
      .setDescription(amountDescription.description)
      .setDate(transaction.date)
      .setProperties(this.filterVisibleProperties(transaction.properties))
      .setCreditAccount(connectedCreditAccount)
      .setDebitAccount(connectedDebitAccount)
      .setChecked(transaction.checked)
    ;

    if (amountDescription.excBaseCode) {
      connectedTransaction.setProperty(EXC_CODE_PROP, amountDescription.excBaseCode);
    }

    if (amountDescription.excBaseRate) {
      connectedTransaction.setProperty(EXC_RATE_PROP, amountDescription.excBaseRate.toString())
    }

    connectedTransaction.setProperty(EXC_AMOUNT_PROP, transaction.amount);

    if (amountDescription.rates) {
      const excLogEntries = await this.buildExcLog(baseBook, connectedBook, transaction, amountDescription);
      if (excLogEntries.length > 0) {
        connectedTransaction.setProperty(EXC_LOG_PROP, JSON.stringify(excLogEntries));
      }
    }

    let urls = transaction.urls;
    if (!urls) {
      urls = [];
    }
    if (transaction.urls) {
      urls = transaction.urls;
    }
    if (transaction.files) {
      transaction.files.forEach(file => {
        urls.push(file.url);
      });
    }

    connectedTransaction.setUrls(urls);

    await connectedTransaction.update();
  }

}
