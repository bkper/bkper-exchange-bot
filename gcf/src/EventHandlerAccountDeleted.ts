import { Account, Book } from "bkper-js";
import { EventHandlerAccount } from "./EventHandlerAccount.js";

export class EventHandlerAccountDeleted extends EventHandlerAccount {
  protected async connectedAccountNotFound(baseBook: Book, connectedBook: Book, account: bkper.Account): Promise<string> {
    let bookAnchor = super.buildBookAnchor(connectedBook);
    return `${bookAnchor}: ACCOUNT ${account.name} NOT Found`;
  }
  protected async connectedAccountFound(baseBook: Book, connectedBook: Book, account: bkper.Account, connectedAccount: Account): Promise<string> {
    if (connectedAccount.hasTransactionPosted()) {
      await connectedAccount.setArchived(true).update();
    } else {
      await connectedAccount.remove();
    }
    let bookAnchor = super.buildBookAnchor(connectedBook);
    return `${bookAnchor}: ACCOUNT ${connectedAccount.getName()} DELETED`;
  }
}
