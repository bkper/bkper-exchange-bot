interface AmountDescription {
  amount: number;
  description: string;
  taxAmount: number;
}

abstract class EventHandlerTransaction extends EventHandler{

  processObject(baseBook: Bkper.Book, connectedBook: Bkper.Book, event: bkper.Event): string {

    let operation = event.data.object as bkper.TransactionOperation;
    let transaction = operation.transaction;

    if (transaction.agentId == 'exchange-bot') {
      console.log("Same payload agent. Preventing bot loop.");
      return null;
    } 

    if (transaction.agentId == 'sales-tax-bot') {
      console.log("Skiping Tax Bot agent.");
      return null;
    } 

    if (!transaction.posted) {
      return null;
    }

    let connectedCode = BotService.getBaseCode(connectedBook);
    if (connectedCode != null && connectedCode != '') {
      let iterator = connectedBook.getTransactions(this.getTransactionQuery(transaction));
      if (iterator.hasNext()) {
        let connectedTransaction = iterator.next();
        return this.connectedTransactionFound(baseBook, connectedBook, transaction, connectedTransaction);
      } else {
        return this.connectedTransactionNotFound(baseBook, connectedBook, transaction)
      }
    }
  }

  protected extractAmountDescription_(book: Bkper.Book, base: string, connectedCode: string, transaction: bkper.Transaction): AmountDescription {

    let ratesEndpointConfig = BotService.getRatesEndpointConfig(book, transaction.date, 'bot');
    ExchangeApp.setRatesEndpoint(ratesEndpointConfig.url, ratesEndpointConfig.cache);

    return BotService.extractAmountDescription_(book, base, connectedCode, transaction)
  }

  protected abstract getTransactionQuery(transaction: bkper.Transaction): string;

  protected abstract connectedTransactionNotFound(baseBook: Bkper.Book, connectedBook: Bkper.Book, transaction: bkper.Transaction): string;

  protected abstract connectedTransactionFound(baseBook: Bkper.Book, connectedBook: Bkper.Book, transaction: bkper.Transaction, connectedTransaction: Bkper.Transaction): string;
}