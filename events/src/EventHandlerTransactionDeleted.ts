import { Book, Transaction } from "bkper-js";
import { EventHandlerTransaction } from "./EventHandlerTransaction.js";
import { AppContext } from "./AppContext.js";

export class EventHandlerTransactionDeleted extends EventHandlerTransaction {
    constructor(context: AppContext) {
        super(context);
    }

    protected getTransactionQuery(transaction: bkper.Transaction): string {
        return `remoteId:${transaction.id}`;
    }

    protected connectedTransactionNotFound(baseBook: Book, connectedBook: Book, transaction: bkper.Transaction): Promise<string> {
        return null;
    }
    protected async connectedTransactionFound(baseBook: Book, connectedBook: Book, transaction: bkper.Transaction, connectedTransaction: Transaction): Promise<string> {

        const timeTag = `Deleted found ${Math.random()}`
        console.time(timeTag)

        let bookAnchor = super.buildBookAnchor(connectedBook);

        if (connectedTransaction.isChecked()) {
            await connectedTransaction.uncheck();
        }
        await connectedTransaction.trash();

        let amountFormatted = connectedBook.formatValue(connectedTransaction.getAmount())

        let record = `DELETED: ${connectedTransaction.getDateFormatted()} ${amountFormatted} ${connectedTransaction.getDescription()}`;

        console.timeEnd(timeTag)

        return `${bookAnchor}: ${record}`;
    }

}
