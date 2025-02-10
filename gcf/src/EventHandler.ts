import { Book } from "bkper-js";
import { getBaseCode, getConnectedBooks, getRatesEndpointConfig } from "./BotService.js";
import { EXC_ON_CHECK_PROP, EXC_CODE_PROP } from "./constants.js";
import { getRates } from "./exchange-service.js";

export abstract class EventHandler {

  protected abstract processObject(baseBook: Book, connectedBook: Book, event: bkper.Event): Promise<string>;

  async handleEvent(event: bkper.Event): Promise<string[] | string | boolean> {

    const eventBook = new Book(event.book);
    const eventBookExcCode = getBaseCode(eventBook);

    if (eventBookExcCode == null || eventBookExcCode == '') {
      return `Please set the "${EXC_CODE_PROP}" property of this book.`;
    }

    const logtag = `Handling ${event.type} event on book ${eventBook.getName()} from user ${event.user.username} ${Math.random()}`;
    console.time(logtag);

    if (event.type == 'TRANSACTION_POSTED') {
      let operation = event.data.object as bkper.TransactionOperation;
      let transaction = operation.transaction;
      if (eventBook.getProperty(EXC_ON_CHECK_PROP, 'exc_auto_check') && !transaction.checked) {
        return false;
      }
    }

    let allConnectedBooks = await getConnectedBooks(eventBook);

    // No connected books
    if (allConnectedBooks == null || allConnectedBooks.length == 0) {
      return false;
    }
    // Event book is the only connected book
    if (allConnectedBooks.length == 1) {
      const connectedBook = allConnectedBooks[0];
      if (connectedBook == null || connectedBook.getId() == eventBook.getId()) {
        return false;
      }
    }

    // Load and cache rates prior to pararllel run
    if (event.type == 'TRANSACTION_CHECKED' || event.type == 'TRANSACTION_POSTED' || event.type == 'TRANSACTION_UPDATED') {
      let operation = event.data.object as bkper.TransactionOperation;
      let transaction = operation.transaction;
      const ratesEndpointConfig = getRatesEndpointConfig(eventBook, transaction);
      // Call to put rates on cache
      await getRates(ratesEndpointConfig.url); 
    }

    let result: string[] = [];

    const chunkSize = 14;
    for (let i = 0; i < allConnectedBooks.length; i += chunkSize) {
      const connectedBooks = allConnectedBooks.slice(i, i + chunkSize);

      let responsesPromises: Promise<string>[] = [];

      for (const connectedBook of connectedBooks) {
        if (connectedBook.getId() == eventBook.getId()) {
          continue;
        }
        let connectedCode = getBaseCode(connectedBook);
        if (connectedCode != null && connectedCode != "") {
          let response = this.processObject(eventBook, connectedBook, event);
          if (response) {
            responsesPromises.push(response);
          }
        }
      }

      if (responsesPromises.length > 0) {
        let partialResult = await Promise.all(responsesPromises);
        partialResult = partialResult.filter(
          (r) => r != null && r.trim() != ""
        );
        if (partialResult.length > 0) {
          result = result.concat(partialResult);
        }
      }
    }

    console.timeEnd(logtag)

    if (result.length == 0) {
      return false;
    }

    return result;
  }

  protected buildBookAnchor(book: Book) {
    return `<a href='https://app.bkper.com/b/#transactions:bookId=${book.getId()}'>${book.getName()}</a>`;
  }

}
