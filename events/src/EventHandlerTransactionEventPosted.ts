import { Book, Transaction } from "bkper-js";
import { EventHandlerTransactionEvent } from './EventHandlerTransactionEvent.js';
import { AppContext } from "./AppContext.js";

export class EventHandlerTransactionPosted extends EventHandlerTransactionEvent {
  constructor(context: AppContext) {
    super(context);
  }

  protected getTransactionQuery(transaction: bkper.Transaction): string {
    return `remoteId:${transaction.id}`;
  }

  protected async connectedTransactionFound(baseBook: Book, connectedBook: Book, transaction: bkper.Transaction, connectedTransaction: Transaction): Promise<string> {
    return null;
  }
  protected async connectedTransactionNotFound(baseBook: Book, connectedBook: Book, transaction: bkper.Transaction): Promise<string> {

    const timeTagWrite = `Posted not found. [Book ${connectedBook.getName()}] [Owner ${connectedBook.getOwnerName()}] ${Math.random()}`
    console.time(timeTagWrite)

    let newTransaction = await super.mirrorTransaction(baseBook, connectedBook, transaction);

    console.timeEnd(timeTagWrite)

    return newTransaction ? `${super.buildBookAnchor(connectedBook)}: ${newTransaction.getDate()} ${newTransaction.getAmount()} ${newTransaction.getDescription()}` : null;
  }


}