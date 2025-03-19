namespace TransactionsUpdateService {

  export function updateTransactions(bookId: any, dateParam: string, exchangeRates: ExchangeRates): Summary {
    let book = BkperApp.getBook(bookId);
    let response = updateTransactionsForBook(book, dateParam, exchangeRates);
    return response;
  }

  function updateTransactionsForBook(baseBook: Bkper.Book, dateParam: string, exchangeRates: ExchangeRates): Summary {
    let connectedBooks = BotService.getConnectedBooks(baseBook);
    let baseCode = BotService.getBaseCode(baseBook);

    if (baseCode == null) {
      return;
    }

    var date = BotService.parseDateParam(dateParam);

    let result: any = {};

    let iterator = baseBook.getTransactions(`on: ${baseBook.formatDate(date)}`)
    while (iterator.hasNext()) {
      let baseTransaction = iterator.next();
      if (baseTransaction.getAgentId() != 'exchange-bot') {

        connectedBooks.forEach(connectedBook => {
          let connectedCode = BotService.getBaseCode(connectedBook);

          if (connectedCode != null) {

            let connectedIterator = connectedBook.getTransactions(`remoteId:${baseTransaction.getId()}`);
            if (connectedIterator.hasNext()) {
              let connectedTransaction = connectedIterator.next();
              let baseTransactionRaw: bkper.Transaction = {
                properties: baseTransaction.getProperties(),
                description: baseTransaction.getDescription(),
                amount: baseTransaction.getAmount().toString(),
              }
              let amountDescription = BotService.extractAmountDescription_(connectedBook, baseCode, connectedCode, baseTransactionRaw, exchangeRates);

              if (!connectedTransaction.getAmount().round(baseBook.getFractionDigits()).eq(amountDescription.amount.round(baseBook.getFractionDigits()))) {
                let wasChecked = false;
                if (connectedTransaction.isChecked()) {
                  wasChecked = true;
                  connectedTransaction = connectedTransaction.uncheck()
                }
                connectedTransaction.setAmount(amountDescription.amount)

                if (amountDescription.excBaseCode) {
                  connectedTransaction.setProperty(EXC_CODE_PROP, amountDescription.excBaseCode);
                }
            
                if (amountDescription.excBaseRate) {
                  connectedTransaction.setProperty(EXC_RATE_PROP, amountDescription.excBaseRate.toString())
                }

                connectedTransaction.update();

                if (wasChecked) {
                  connectedTransaction.check();
                }
                if (result[connectedCode] == null) {
                  result[connectedCode] = 0;
                }
                result[connectedCode]++;
              }
            }
          }

        });
        
      }
    }

    return {code: baseCode, result: JSON.stringify(result)};

  }
  

}