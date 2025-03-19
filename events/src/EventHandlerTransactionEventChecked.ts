import { Book, Transaction } from "bkper-js";
import { getBaseCode } from "./BotService.js";
import { EXC_RATE_PROP, EXC_LOG_PROP } from "./constants.js";
import { AmountDescription, ExcLogEntry } from "./EventHandlerTransaction.js";
import { EventHandlerTransactionEvent } from "./EventHandlerTransactionEvent.js";

export class EventHandlerTransactionChecked extends EventHandlerTransactionEvent {

  protected getTransactionQuery(transaction: bkper.Transaction): string {
    return `remoteId:${transaction.id}`;
  }

  protected async connectedTransactionFound(baseBook: Book, connectedBook: Book, transaction: bkper.Transaction, connectedTransaction: Transaction): Promise<string> {

    const timeTag = `Checked found ${Math.random()}`;
    console.time(timeTag);

    let baseCode = getBaseCode(baseBook);
    let connectedCode = getBaseCode(connectedBook);

    let amountDescription = await super.extractAmountDescription_(baseBook, connectedBook, baseCode, connectedCode, transaction);

    let resp = null;

    // Build exchange log
    let excLogEntries: ExcLogEntry[] = [];
    if (amountDescription.rates) {
      excLogEntries = await this.buildExcLog(baseBook, connectedBook, transaction, amountDescription);
    }

    if (this.amountHasChanged(connectedTransaction, amountDescription) || excLogEntries.length > 0) {

      if (this.amountHasChanged(connectedTransaction, amountDescription)) {
        connectedTransaction.setAmount(amountDescription.amount);
        connectedTransaction.setProperty(EXC_RATE_PROP, amountDescription.excBaseRate.toString());
      }

      if (excLogEntries.length > 0) {
        connectedTransaction.setProperty(EXC_LOG_PROP, JSON.stringify(excLogEntries));
      }

      if (connectedTransaction.isChecked()) {
        await connectedTransaction.uncheck();
      }
      await connectedTransaction.setChecked(true).update();

      resp = this.buildCheckResponse("UPDATED AND CHECKED", connectedBook, connectedTransaction);

    } else if (connectedTransaction.isPosted() && !connectedTransaction.isChecked()) {
      await connectedTransaction.check();
      resp = this.buildCheckResponse("CHECKED", connectedBook, connectedTransaction);

    } else if (!connectedTransaction.isPosted() && this.isReadyToPost(connectedTransaction.json())) {
      await connectedTransaction.setChecked(true).post();
      resp = this.buildCheckResponse("POSTED AND CHECKED", connectedBook, connectedTransaction);

    } else {
      resp = this.buildCheckResponse("ALREADY CHECKED", connectedBook, connectedTransaction);
    }

    console.timeEnd(timeTag);
    return resp;
  }

  private buildCheckResponse(tag: string, connectedBook: Book, connectedTransaction: Transaction) {
    let bookAnchor = super.buildBookAnchor(connectedBook);
    let amountFormatted = connectedBook.formatValue(connectedTransaction.getAmount());
    let record = `${tag}: ${connectedTransaction.getDateFormatted()} ${amountFormatted} ${connectedTransaction.getDescription()}`;
    return `${bookAnchor}: ${record}`;
  }

  protected async connectedTransactionNotFound(baseBook: Book, connectedBook: Book, transaction: bkper.Transaction): Promise<string> {

    const timeTagWrite = `Checked not found. [Book ${connectedBook.getName()}] [Owner ${connectedBook.getOwnerName()}] ${Math.random()}`;
    console.time(timeTagWrite);

    let newTransaction = await super.mirrorTransaction(baseBook, connectedBook, transaction);

    console.timeEnd(timeTagWrite);
    return newTransaction ? `${super.buildBookAnchor(connectedBook)}: ${newTransaction.getDate()} ${newTransaction.getAmount()} ${newTransaction.getDescription()}` : null;
  }

  private amountHasChanged(connectedTransaction: Transaction, amountDescription: AmountDescription): boolean {
    const NUM_OF_DECIMAL_PLACES = 3;
    let currentAmount = connectedTransaction.getAmount();
    return !currentAmount.round(NUM_OF_DECIMAL_PLACES).eq(amountDescription.amount.round(NUM_OF_DECIMAL_PLACES));
  }
  
}
