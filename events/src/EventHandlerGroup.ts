import { Book, Group } from "bkper-js";
import { EventHandler } from "./EventHandler.js";

export abstract class EventHandlerGroup extends EventHandler {

  protected async processObject(baseBook: Book, connectedBook: Book, event: bkper.Event): Promise<string> {
    let connectedCode = this.botService.getBaseCode(connectedBook);
    let group = event.data.object as bkper.Group;

    if (connectedCode != null && connectedCode != '') {

      const timeTagWrite = `EventHandlerGroup getGroup. [Book ${connectedBook.getName()}] [Owner ${connectedBook.getOwnerName()}] ${Math.random()}`;
      console.time(timeTagWrite);

      let connectedGroup = await connectedBook.getGroup(group.name);
      if (connectedGroup == null && (event.data.previousAttributes && event.data.previousAttributes['name'])) {
        connectedGroup = await connectedBook.getGroup(event.data.previousAttributes['name']);
      }

      if (connectedGroup == null) {
        connectedGroup = await connectedBook.getGroup(group.name + ' ');
      }

      console.timeEnd(timeTagWrite);

      if (connectedGroup) {
        return await this.connectedGroupFound(baseBook, connectedBook, group, connectedGroup);
      } else {
        return await this.connectedGroupNotFound(baseBook, connectedBook, group);
      }
    }
    return null;
  }

  protected abstract connectedGroupNotFound(baseBook: Book, connectedBook: Book, group: bkper.Group): Promise<string>;

  protected abstract connectedGroupFound(baseBook: Book, connectedBook: Book, group: bkper.Group, connectedGroup: Group): Promise<string>;

}