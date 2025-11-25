import { describe, test, expect } from "bun:test";
import { ExchangeService } from "../src/ExchangeService.js";
import { AppContext } from "../src/AppContext.js";
import { Bkper, Amount } from "bkper-js";
import { ExchangeRates } from "../src/ExchangeRates.js";

function createMockContext(): AppContext {
  return new AppContext({} as Bkper, {});
}

function createRates(base: string, rates: Record<string, string>): ExchangeRates {
  return {
    base,
    rates,
    status: 200,
  };
}

describe("ExchangeService", () => {

  describe("convertBase", () => {
    test("returns same rates when base matches", () => {
      const service = new ExchangeService(createMockContext());
      const rates = createRates("USD", { EUR: "0.85", GBP: "0.73" });

      const result = service.convertBase(rates, "USD");

      expect(result!.base).toBe("USD");
      expect(result!.rates["USD"]).toBe("1");
    });

    test("converts rates to new base", () => {
      const service = new ExchangeService(createMockContext());
      const rates = createRates("USD", { EUR: "0.5", GBP: "0.25" });

      const result = service.convertBase(rates, "EUR");

      expect(result!.base).toBe("EUR");
      expect(result!.rates["USD"]).toBe("2");
      expect(result!.rates["GBP"]).toBe("0.5");
    });

    test("returns null when target base not found", () => {
      const service = new ExchangeService(createMockContext());
      const rates = createRates("USD", { EUR: "0.85" });

      const result = service.convertBase(rates, "XXX");

      expect(result).toBeNull();
    });
  });

  describe("convert", () => {
    test("converts amount using rates", async () => {
      const service = new ExchangeService(createMockContext());
      const rates = createRates("USD", { EUR: "0.5", BRL: "5" });

      const result = await service.convert(new Amount("100"), "USD", "BRL", rates);

      expect(result.base).toBe("USD");
      expect(result.rate.toString()).toBe("5");
      expect(result.amount?.toString()).toBe("500");
    });

    test("converts with base change", async () => {
      const service = new ExchangeService(createMockContext());
      const rates = createRates("USD", { EUR: "0.5", BRL: "5" });

      const result = await service.convert(new Amount("100"), "EUR", "BRL", rates);

      expect(result.base).toBe("EUR");
      expect(result.amount?.toString()).toBe("1000");
    });

    test("throws when from code not found", async () => {
      const service = new ExchangeService(createMockContext());
      const rates = createRates("USD", { EUR: "0.85" });

      expect(service.convert(new Amount("100"), "XXX", "EUR", rates)).rejects.toThrow();
    });

    test("throws when to code not found", async () => {
      const service = new ExchangeService(createMockContext());
      const rates = createRates("USD", { EUR: "0.85" });

      expect(service.convert(new Amount("100"), "USD", "XXX", rates)).rejects.toThrow();
    });

    test("throws when rates have error", async () => {
      const service = new ExchangeService(createMockContext());
      const rates: ExchangeRates = {
        base: "USD",
        rates: {},
        status: 400,
        error: true,
        description: "Invalid request",
      };

      expect(service.convert(new Amount("100"), "USD", "EUR", rates)).rejects.toThrow("Invalid request");
    });
  });

});
