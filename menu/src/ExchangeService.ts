interface ExchangeRates {
  base: string;
  date: string;
  rates: {
    [key: string]: number|string;
  }
}

interface ConvertedAmount {
  amount?: Bkper.Amount;
  base: string;
  rate: Bkper.Amount;
}

namespace ExchangeService {

  export function getRates(ratesEndpointUrl: string, cacheInSeconds: number): ExchangeRates {
    
    let cachedRatesJson = CacheService.getScriptCache().get(ratesEndpointUrl);
    
    if (cachedRatesJson != null) {
      return JSON.parse(cachedRatesJson);
    } else {

      let ratesJson: string = null;

      var retries = 0;
      var sleepTime = 1000;
      while (true) {
        try {
          ratesJson = UrlFetchApp.fetch(ratesEndpointUrl).getContentText();
          break;
        } catch (networkError) {
          //Error on fetch service
          if (retries > 3) {
            throw networkError;
          } else {
            Logger.log("Retrying in " + (sleepTime / 1000) + " secs...");
            Utilities.sleep(sleepTime);
            sleepTime = sleepTime + 500;
            retries++;
          }
        }
      }


      let rates: ExchangeRates = JSON.parse(ratesJson);

      if (rates == null) {
        throw `Unable to get exchange rates from endpoint ${ratesEndpointUrl}`;
      }

      if (rates.base == null || rates.rates == null) {
        throw `Rates json from ${ratesEndpointUrl} in wrong format. Expected:
        {
          base: string;
          date: string;
          rates: {
            [key: string]: number;
          }
        }
        `;
      }

      if (cacheInSeconds == null || cacheInSeconds > 3600) {
        cacheInSeconds = 3600;
      } else if (cacheInSeconds < 300) {
        cacheInSeconds = 300;
      }

      CacheService.getScriptCache().put(ratesEndpointUrl, ratesJson, cacheInSeconds);

      return rates;
    }
  }

  export function convert(value: Bkper.Amount, from: string, to: string, rates: ExchangeRates): ConvertedAmount {

    if (rates == null) {
      throw 'rates must be provided.'
    }
  
    rates = convertBase(rates, from);
  
    if (rates == null) {
      throw `Code ${from} not found in rates`
    }
  
    let rate = rates.rates[to];
    if (rate == null) {
      throw `Code ${to} not found in ${JSON.stringify(rates)}`
    }

    return {
      base: rates.base,
      rate: BkperApp.newAmount(rate),
      amount: BkperApp.newAmount(rate).times(value)
    }
  }

  function convertBase(rates: ExchangeRates, toBase: string): ExchangeRates {
    rates.rates[rates.base] = 1
    if (rates.base == toBase) {
      return rates;
    }
    let rate = rates.rates[toBase]
    if (rate == null) {
      return null;
    }
    let newRate = BkperApp.newAmount('1').div(rate);
    rates.base = toBase;
    for (let [key, value] of Object.entries(rates.rates)) {
      rates.rates[key] = BkperApp.newAmount(value).times(newRate).toString();
    }
    return rates;
  }

}