import { Book, Group } from "bkper-js";
import { CHILD_BOOK_ID_PROP } from "./constants.js";
import { EventHandlerGroup } from "./EventHandlerGroup.js";

export class EventHandlerGroupCreatedOrUpdated extends EventHandlerGroup {
  protected async connectedGroupNotFound(baseBook: Book, connectedBook: Book, baseGroup: bkper.Group): Promise<string> {
    let parentGroup = baseGroup.parent ? await connectedBook.getGroup(baseGroup.parent.name) : null;
    let connectedGroup = await new Group(connectedBook)
    .setName(baseGroup.name)
    .setParent(parentGroup)
    .setHidden(baseGroup.hidden)
    .setProperties(baseGroup.properties)
    .deleteProperty(CHILD_BOOK_ID_PROP)
    .create();
    let bookAnchor = super.buildBookAnchor(connectedBook);
    return `${bookAnchor}: GROUP ${connectedGroup.getName()} CREATED`;
  }
  protected async connectedGroupFound(baseBook: Book, connectedBook: Book, baseGroup: bkper.Group, connectedGroup: Group): Promise<string> {
    let connectedChildBookId = connectedGroup.getProperty(CHILD_BOOK_ID_PROP)
    let parentGroup = baseGroup.parent ? await connectedBook.getGroup(baseGroup.parent.name) : null;

    await connectedGroup
    .setName(baseGroup.name)
    .setParent(parentGroup)
    .setHidden(baseGroup.hidden)
    .setProperties(baseGroup.properties)
    .setProperty(CHILD_BOOK_ID_PROP, connectedChildBookId)
    .update();
    let bookAnchor = super.buildBookAnchor(connectedBook);
    return `${bookAnchor}: GROUP ${connectedGroup.getName()} UPDATED`;
  }


}