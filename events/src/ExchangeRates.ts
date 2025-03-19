/**
 * The Rates to be applied when exchanging values
 */
export interface ExchangeRates {
  base: string
  date?: string
  error?: boolean
  message?: string
  status: number
  description?: string
  rates: {
    [key: string]: number|string;
  }
}