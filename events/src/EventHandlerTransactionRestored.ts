import { Book, Transaction } from "bkper-js";
import { EventHandlerTransaction } from "./EventHandlerTransaction.js";
import { AppContext } from "./AppContext.js";

export class EventHandlerTransactionRestored extends EventHandlerTransaction {
  constructor(context: AppContext) {
    super(context);
  }
  
  protected getTransactionQuery(transaction: bkper.Transaction): string {
    return `remoteId:${transaction.id} is:trashed`;
  }

  protected connectedTransactionNotFound(baseBook: Book, connectedBook: Book, transaction: bkper.Transaction): Promise<string> {
    return null;
  }
  protected async connectedTransactionFound(baseBook: Book, connectedBook: Book, transaction: bkper.Transaction, connectedTransaction: Transaction): Promise<string> {
    let bookAnchor = super.buildBookAnchor(connectedBook);

    await connectedTransaction.untrash();

    let amountFormatted = connectedBook.formatValue(connectedTransaction.getAmount())

    let record = `RESTORED: ${connectedTransaction.getDateFormatted()} ${amountFormatted} ${connectedTransaction.getDescription()}`;

    return `${bookAnchor}: ${record}`;
  }

}
