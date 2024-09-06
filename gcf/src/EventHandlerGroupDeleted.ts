import { Book, Group } from "bkper-js";
import { EventHandlerGroup } from "./EventHandlerGroup.js";

export class EventHandlerGroupDeleted extends EventHandlerGroup {
  protected async connectedGroupNotFound(baseBook: Book, connectedBook: Book, group: bkper.Group): Promise<string> {
    let bookAnchor = super.buildBookAnchor(connectedBook);
    return `${bookAnchor}: GROUP ${group.name} NOT Found`;
  }
  protected async connectedGroupFound(baseBook: Book, connectedBook: Book, group: bkper.Group, connectedGroup: Group): Promise<string> {
    await connectedGroup.remove();
    let bookAnchor = super.buildBookAnchor(connectedBook);
    return `${bookAnchor}: GROUP ${connectedGroup.getName()} DELETED`;
  }

}