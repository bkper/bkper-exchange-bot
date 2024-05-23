import { Bkper, Book } from "bkper";
import { getBaseCode, getConnectedBooks, getRatesEndpointConfig, isBaseBook } from "./BotService";
import {  EXC_ON_CHECK_PROP, EXC_CODE_PROP } from "./constants";
import { getRates } from "./exchange-service";

export abstract class EventHandler {

  protected abstract processObject(baseBook: Book, connectedBook: Book, event: bkper.Event): Promise<string>;

  async handleEvent(event: bkper.Event): Promise<string[] | string | boolean> {
    let baseBook = new Book(event.book);
    let baseCode = getBaseCode(baseBook);

    if (baseCode == null || baseCode == '') {
      return `Please set the "${EXC_CODE_PROP}" property of this book.`
    }

    const logtag = `Handling ${event.type} event on book ${baseBook.getName()} from user ${event.user.username} ${Math.random()}`;

    console.time(logtag)

    if (event.type == 'TRANSACTION_POSTED') {
      let operation = event.data.object as bkper.TransactionOperation;
      let transaction = operation.transaction;
      if (baseBook.getProperty(EXC_ON_CHECK_PROP, 'exc_auto_check') && !transaction.checked) {
        return false;
      }
    }

    if (event.type == 'TRANSACTION_CHECKED' || event.type == 'TRANSACTION_POSTED' || event.type == 'TRANSACTION_UPDATED') {
      //Load and cache rates prior to pararllel run
      let operation = event.data.object as bkper.TransactionOperation;
      let transaction = operation.transaction;

      let ratesEndpointConfig = getRatesEndpointConfig(baseBook, transaction);
      //Call to put rates on cache
      await getRates(ratesEndpointConfig.url)
    }

    let allConnectedBooks = await getConnectedBooks(baseBook);

    let result: string[] = [];

    const chunkSize = 10;
    for (let i = 0; i < allConnectedBooks.length; i += chunkSize) {
      const connectedBooks = allConnectedBooks.slice(i, i + chunkSize);

      let responsesPromises: Promise<string>[] = [];

      for (const connectedBook of connectedBooks) {
        if (connectedBook.getId() == baseBook.getId()) {
          continue;
        }
        let connectedCode = getBaseCode(connectedBook);
        if (connectedCode != null && connectedCode != "") {
          let response = this.processObject(baseBook, connectedBook, event);
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