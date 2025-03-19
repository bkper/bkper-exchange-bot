BkperApp.setApiKey(PropertiesService.getScriptProperties().getProperty('API_KEY'));

const EXC_RATES_URL_PROP = 'exc_rates_url';
const EXC_RATES_CACHE_PROP = 'exc_rates_cache';
const EXC_ACCOUNT_PROP = 'exc_account';
const EXC_CODE_PROP = 'exc_code';
const EXC_AMOUNT_PROP = 'exc_amount';
const EXC_BASE_PROP = 'exc_base';
const EXC_RATE_PROP = 'exc_rate';
const EXC_ON_CHECK = 'exc_on_check';
const EXC_HISTORICAL_PROP = 'exc_historical';
const EXC_AGGREGATE_PROP = 'exc_aggregate';
const STOCK_EXC_CODE_PROP = 'stock_exc_code';

function doGet(e: GoogleAppsScript.Events.AppsScriptHttpRequestEvent) {
  //@ts-ignore
  let bookId = e.parameter.bookId;
  return BotViewService.getGainLossViewTemplate(bookId);
}

function loadRates(bookId: string, date: string): ExchangeRates {
  return BotViewService.loadRates(bookId, date);
}

function updateGainLoss(bookId: string, dateParam: string, exchangeRates: ExchangeRates): Summary {
  return GainLossUpdateService.updateGainLoss(bookId, dateParam, exchangeRates);
}

function auditBooks(bookId: string) {
  BotViewService.auditBooks(bookId);
}

// function updateTransactions(bookId: string, dateParam: string, exchangeRates: ExchangeRates): Summary {
//   return TransactionsUpdateService.updateTransactions(bookId, dateParam, exchangeRates);
// }








