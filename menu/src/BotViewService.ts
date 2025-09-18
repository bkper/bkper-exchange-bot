

namespace BotViewService {

  export function auditBooks(bookId: string): void {
    let book = BkperApp.getBook(bookId);
    let connectedBooks = BotService.getConnectedBooks(book);
    connectedBooks.add(book);
    connectedBooks.forEach(b => {
      b.audit();
    });

  }

  export function getGainLossViewTemplate(bookId: string): GoogleAppsScript.HTML.HtmlOutput {
    
    // Current book
    const book = BkperApp.getBook(bookId);
    
    const template = HtmlService.createTemplateFromFile('BotView');
    template.today =  Utilities.formatDate(new Date(), book.getTimeZone(), 'yyyy-MM-dd');
    template.books = [];

    const hasBaseBookInCollection = BotService.hasBaseBookInCollection(book);

    let bookExcCodesPendingTasks: string[] = [];

    const connectedBooks = BotService.getConnectedBooks(book);
    for (const connectedBook of connectedBooks) {
      // Check if connected book has pending tasks
      if (BotService.hasPendingTasks(connectedBook)) {
        bookExcCodesPendingTasks.push(BotService.getBaseCode(connectedBook));
      }
      // Add book to template
      template.books.push({
        id: connectedBook.getId(),
        name: connectedBook.getName(),
        code: BotService.getBaseCode(connectedBook),
        base: BotService.isBaseBook(connectedBook) || !hasBaseBookInCollection
      })
    }

    // Check if current book has pending tasks
    if (BotService.hasPendingTasks(book)) {
      bookExcCodesPendingTasks.push(BotService.getBaseCode(book));
    }

    // Add current book to template
    template.book = {
      id: book.getId(),
      name: book.getName(),
      code: BotService.getBaseCode(book),
      base: BotService.isBaseBook(book) || !hasBaseBookInCollection
    }
    template.books.push(template.book);

    // Show validation errors
    if (!BotService.canUserEditBook(book)) {
      template.basePermissionGranted = false;
      template.permissionError = `User needs EDITOR or OWNER permission in ${book.getName()} book`;
      return template.evaluate().setTitle('Exchange Bot').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    } else {
      template.basePermissionGranted = true;
    }

    const bookExcCodesUserCanView = BotService.getBooksExcCodesUserCanView(book);
    const bookConfiguredExcCodes = BotService.getBookConfiguredExcCodes(book);

    // Validate user permissions
    let bookExcCodesUserCannotView: string[] = [];
    for (const code of Array.from(bookConfiguredExcCodes)) {
      if (!bookExcCodesUserCanView.has(code)) {
        bookExcCodesUserCannotView.push(code);
      }
    }

    // Check bot errors in the collection
    let bookExcCodesWithErrors = Array.from(BotService.getCollectionBooksWithErrors(book));

    // Show validation warnings
    if (bookExcCodesUserCannotView.length > 0) {
      template.permissionGranted = false;
      template.permissionError = `User needs permission in ${bookExcCodesUserCannotView.join(', ')} ${BotService.getErrorText(bookExcCodesUserCannotView)}`;
    } else if (bookExcCodesPendingTasks.length > 0) {
      template.permissionGranted = false;
      template.permissionError = `There are pending bot tasks in ${bookExcCodesPendingTasks.join(', ')} ${BotService.getErrorText(bookExcCodesPendingTasks)}`;
    } else if (bookExcCodesWithErrors.length > 0) {
      template.permissionGranted = false;
      template.permissionError = `There are bot errors in ${bookExcCodesWithErrors.join(', ')} ${BotService.getErrorText(bookExcCodesWithErrors)}`;
    } else {
      template.permissionGranted = true;
    }

    return template.evaluate().setTitle('Exchange Bot').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  export function loadRates(bookId: string, date: string): ExchangeRates {
    let book = BkperApp.getBook(bookId);
    let ratesEndpointConfig = BotService.getRatesEndpointConfig(book, date, 'app');
    let ratesJSON = UrlFetchApp.fetch(ratesEndpointConfig.url).getContentText();
    let exchangeRates = JSON.parse(ratesJSON) as ExchangeRates;

    let codes: string[] = [];
    BotService.getConnectedBooks(book).add(book).forEach(book => codes.push(BotService.getBaseCode(book)));

    for (const rate in exchangeRates.rates) {
      if (!codes.includes(rate)) {
        delete exchangeRates.rates[rate];
      }
    }

    if (exchangeRates.rates[exchangeRates.base]) {
      delete exchangeRates.rates[exchangeRates.base];
    }

    return exchangeRates;
  }

}
