import { Account, AccountType, Book } from "bkper-js";
import { EventHandlerAccount } from "./EventHandlerAccount.js";

export class EventHandlerAccountCreatedOrUpdated extends EventHandlerAccount {

  public async connectedAccountNotFound(baseBook: Book, connectedBook: Book, baseAccount: bkper.Account): Promise<string> {

    const timeTagWrite = `AccountCreatedOrUpdated not found write. [Book ${connectedBook.getName()}] [Owner ${connectedBook.getOwnerName()}] ${Math.random()}`
    console.time(timeTagWrite)

    let connectedAccount = new Account(connectedBook);
    this.syncAccounts(baseBook, connectedBook, baseAccount, connectedAccount);
    await connectedAccount.create();
    let bookAnchor = super.buildBookAnchor(connectedBook);
    
    console.timeEnd(timeTagWrite)

    return `${bookAnchor}: ACCOUNT ${connectedAccount.getName()} CREATED`;
  }

  protected async connectedAccountFound(baseBook: Book, connectedBook: Book, baseAccount: bkper.Account, connectedAccount: Account): Promise<string> {
    const timeTagWrite = `AccountCreatedOrUpdated found write. [Book ${connectedBook.getName()}] [Owner ${connectedBook.getOwnerName()}] ${Math.random()}`
    console.time(timeTagWrite)
    this.syncAccounts(baseBook, connectedBook, baseAccount, connectedAccount);
    await connectedAccount.update();
    let bookAnchor = super.buildBookAnchor(connectedBook);
    console.timeEnd(timeTagWrite)
    return `${bookAnchor}: ACCOUNT ${connectedAccount.getName()} UPDATED`;
  }

  protected syncAccounts(baseBook: Book, connectedBook: Book, baseAccount: bkper.Account, connectedAccount: Account) {
    connectedAccount.setGroups(baseAccount.groups);
    connectedAccount.setName(baseAccount.name)
      .setType(baseAccount.type as AccountType)
      .setProperties(this.filterVisibleProperties(baseAccount.properties))
      .setArchived(baseAccount.archived);
  }

}