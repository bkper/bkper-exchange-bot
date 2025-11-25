import { Amount, Book } from "bkper-js";
import { EXC_AMOUNT_PROP, EXC_BASE_PROP, EXC_CODE_PROP, EXC_RATE_PROP, EXC_RATES_URL_PROP, EXC_DATE_PROP } from "./constants.js";
import { AmountDescription } from "./EventHandlerTransaction.js";
import { ExchangeService } from "./ExchangeService.js";
import { ExchangeRates } from "./ExchangeRates.js";
import { AppContext } from "./AppContext.js";

interface RatesEndpointConfig {
    url: string
}

export class BotService {
    private context: AppContext;
    private exchangeService: ExchangeService;

    constructor(context: AppContext) {
        this.context = context;
        this.exchangeService = new ExchangeService(context);
    }

    getRatesEndpointConfig(book: Book, transaction: bkper.Transaction): RatesEndpointConfig {
        //Read from properties
        let ratesUrl = book.getProperty(EXC_RATES_URL_PROP, 'exchange_rates_url');

        let date = transaction.date;

        let excDateProp = transaction.properties[EXC_DATE_PROP]
        if (excDateProp) {
            let parsedDate = book.parseDate(excDateProp)
            // checks if parsedDate is valid
            if (!Number.isNaN(new Date(parsedDate).getTime())) {
                date = parsedDate.toISOString().substring(0, 10);
            } else {
                const dateFormat = book.getDatePattern()
                throw `Invalid range for ${EXC_DATE_PROP} property. Use appropriated date in ${dateFormat} format, instead of ${excDateProp}.`
            }
        }

        //Default values
        if (ratesUrl == null || ratesUrl.trim() == '') {
            ratesUrl = "https://openexchangerates.org/api/historical/${date}.json?show_alternative=true&app_id=" + this.context.env.open_exchange_rates_app_id;
        }

        //Use today if date in future
        let today = new Date();
        let parsedDate = book.parseDate(date);
        if (parsedDate.getTime() > today.getTime()) {
            date = today.toISOString().substring(0, 10);
        }

        //deprecated
        ratesUrl = ratesUrl.replace("${transaction.date}", date);
        ratesUrl = ratesUrl.replace("${date}", date);
        ratesUrl = ratesUrl.replace("${agent}", 'bot');

        return {
            url: ratesUrl
        }
    }

    async getConnectedBooks(book: Book): Promise<Array<Book>> {
        const bookVisibleProperties = book.getVisibleProperties();
        if (bookVisibleProperties == null) {
            return new Array<Book>();
        }
        let books = new Array<Book>();

        //deprecated
        for (const key in bookVisibleProperties) {
            if ((key.startsWith('exc')) && key.endsWith('_book')) {
                books.push(await this.context.bkper.getBook(bookVisibleProperties[key]));
            }
        }

        //deprecated
        var exc_books = book.getProperty('exc_books');
        if (exc_books != null && exc_books.trim() != '') {
            var bookIds = exc_books.split(/[ ,]+/);
            for (var bookId of bookIds) {
                if (bookId != null && bookId.trim().length > 10) {
                    books.push(await this.context.bkper.getBook(bookId));
                }
            }
        }

        let collectionBooks = book.getCollection() != null ? book.getCollection().getBooks() : null;
        if (collectionBooks) {
            for (const b of collectionBooks) {
                if (this.getBaseCode(b) != null && this.getBaseCode(b) != 'TEMPLATE') {
                    books.push(b);
                }
            }
        }

        return books;
    }

    isBaseBook(book: Book): boolean {
        if (book.getProperty(EXC_BASE_PROP)) {
            return true;
        } else {
            return false;
        }
    }

    hasBaseBookInCollection(book: Book): boolean {
        let collectionBooks = book.getCollection() != null ? book.getCollection().getBooks() : null;
        if (collectionBooks) {
            for (const b of collectionBooks) {
                if (this.isBaseBook(b)) {
                    return true;
                }
            }
        }

        return false;
    }

    getBaseCode(book: Book): string {
        return book.getProperty(EXC_CODE_PROP, 'exchange_code');
    }

    async getAccountExcCode(book: Book, account: bkper.Account): Promise<string> {
        let groups = account.groups;
        if (groups) {
            for (const group of groups) {
                let excCode = await this.getGroupExcCode(book, group);
                if (excCode) {
                    return excCode;
                }
            }
        }
        return undefined;
    }

    private async getGroupExcCode(book: Book, group: bkper.Group): Promise<string> {
        let exchangeBooks = await this.getConnectedBooks(book);
        for (const exchangeBook of exchangeBooks) {
            let bookExcCode = this.getBaseCode(exchangeBook);
            if (group.name == bookExcCode) {
                return group.name;
            }
        }
        return group.properties[EXC_CODE_PROP];
    }

    async extractAmountDescription_(baseBook: Book, connectedBook: Book, base: string, connectedCode: string, transaction: bkper.Transaction, ratesEndpointUrl: string): Promise<AmountDescription> {
        if (ratesEndpointUrl == null) {
            throw 'exchangeRatesUrl must be provided.';
        }
        let rates = await this.exchangeService.getRates(ratesEndpointUrl);
        let amountDescription = await this.getAmountDescription_(baseBook, connectedBook, base, connectedCode, transaction, rates);
        amountDescription.amount = amountDescription.amount.round(8);
        amountDescription.excBaseRate = amountDescription.amount.div(transaction.amount);
        amountDescription.rates = rates;
        return amountDescription;
    }

    private async getAmountDescription_(baseBook: Book, connectedBook: Book, base: string, connectedCode: string, transaction: bkper.Transaction, rates: ExchangeRates): Promise<AmountDescription> {

        let txExcAmount = transaction.properties[EXC_AMOUNT_PROP];
        let txExcRate = transaction.properties[EXC_RATE_PROP];
        let txExcCode = transaction.properties[EXC_CODE_PROP];

        if (txExcAmount && (connectedCode == txExcCode || this.match(baseBook, connectedCode, transaction))) {
            const amount = connectedBook.parseValue(txExcAmount);
            return {
                amount: amount,
                excBaseCode: base,
                description: transaction.description,
            };
        }

        if (txExcRate && (connectedCode == txExcCode || this.isBaseBook(connectedBook) || this.match(baseBook, connectedCode, transaction))) {
            const excRate = connectedBook.parseValue(txExcRate);
            return {
                amount: excRate.times(transaction.amount),
                excBaseCode: base,
                description: transaction.description,
            };
        }

        let parts = transaction.description.split(' ');

        for (const part of parts) {
            if (part.startsWith(connectedCode)) {
                try {
                    const amount = connectedBook.parseValue(part.replace(connectedCode, ''));
                    let ret: AmountDescription = {
                        amount: amount,
                        excBaseCode: base,
                        description: transaction.description.replace(part, `${base}${transaction.amount}`),
                    };
                    if (ret.amount) {
                        return ret;
                    }
                } catch (error) {
                    continue;
                }
            }
        }

        const convertedAmount = await this.exchangeService.convert(new Amount(transaction.amount), base, connectedCode, rates);

        return {
            amount: convertedAmount.amount,
            excBaseCode: convertedAmount.base,
            description: `${transaction.description}`,
        };
    }

    match(baseBook: Book, connectedCode: string, transaction: bkper.Transaction): boolean {

        const creditGroups = transaction.creditAccount.groups;
        const debitGroups = transaction.debitAccount.groups;

        if (creditGroups != null) {
            for (const group of creditGroups) {
                if (group.name == connectedCode) {
                    return true;
                }
                if (group.properties[EXC_CODE_PROP] == connectedCode) {
                    return true;
                }
            }
        }

        if (debitGroups != null) {
            for (const group of debitGroups) {
                if (group.name == connectedCode) {
                    return true;
                }
                if (group.properties[EXC_CODE_PROP] == connectedCode) {
                    return true;
                }
            }
        }

        return false;
    }
}
