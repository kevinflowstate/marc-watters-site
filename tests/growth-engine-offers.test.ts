import { describe, expect, it } from "vitest";
import { GROWTH_ENGINE_OFFERS } from "../lib/growth-engine-offers";

describe("Growth Engine regional offers", () => {
  it("uses the verified UK Stripe links and prices", () => {
    expect(GROWTH_ENGINE_OFFERS.uk).toMatchObject({
      leadGeneration: {
        checkoutUrl: "https://buy.stripe.com/dRm5kFaYQ1sAgGv6rW97G02",
        firstPayment: "£2,225",
        thenMonthly: "£1,250/month",
      },
      receptionist: {
        checkoutUrl: "https://buy.stripe.com/3cI5kF2skfjq9e39E897G0e",
        firstPayment: "£699",
        thenMonthly: "£199/month",
      },
      webinar: {
        checkoutUrl: "https://buy.stripe.com/eVqcN74As0ow61R03y97G08",
        firstPayment: "£8,250",
      },
      websites: {
        a: {
          checkoutUrl: "https://buy.stripe.com/5kQdRbd6Y3AIfCr3fK97G0a",
          firstPayment: "£995",
        },
        b: {
          checkoutUrl: "https://buy.stripe.com/6oU7sN8QI8V289Z4jO97G0c",
          firstPayment: "£2,495",
        },
        c: {
          checkoutUrl: "https://buy.stripe.com/8x228t8QIefmai75nS97G0g",
          firstPayment: "£3,349",
          thenMonthly: "£99/month",
        },
      },
    });
  });

  it("uses the verified Republic of Ireland Stripe links and prices", () => {
    expect(GROWTH_ENGINE_OFFERS.ireland).toMatchObject({
      leadGeneration: {
        checkoutUrl: "https://buy.stripe.com/eVq00l5Ew8V24XN03y97G03",
        firstPayment: "£2,225",
        thenMonthly: "£1,250/month",
      },
      receptionist: {
        checkoutUrl: "https://buy.stripe.com/9B66oJ4As7QYfCr3fK97G0f",
        firstPayment: "£699",
        thenMonthly: "£199/month",
      },
      webinar: {
        checkoutUrl: "https://buy.stripe.com/6oUfZj2skc7e2PFcQk97G09",
        firstPayment: "£8,250",
      },
      websites: {
        a: {
          checkoutUrl: "https://buy.stripe.com/8x2fVjaYQ0owfCr8A497G0b",
          firstPayment: "£995",
        },
        b: {
          checkoutUrl: "https://buy.stripe.com/eVq9AV3wo6MU89Z6rW97G0d",
          firstPayment: "£2,495",
        },
        c: {
          checkoutUrl: "https://buy.stripe.com/00weVf7ME2wEbmb9E897G0h",
          firstPayment: "£3,349",
          thenMonthly: "£99/month",
        },
      },
    });
  });

  it("keeps every checkout on Stripe Payment Links", () => {
    const regions = Object.values(GROWTH_ENGINE_OFFERS);
    const checkoutUrls = regions.flatMap((region) => [
      region.leadGeneration.checkoutUrl,
      region.receptionist.checkoutUrl,
      region.webinar.checkoutUrl,
      region.websites.a.checkoutUrl,
      region.websites.b.checkoutUrl,
      region.websites.c.checkoutUrl,
    ]);

    expect(checkoutUrls).toHaveLength(12);
    expect(checkoutUrls.every((url) => url.startsWith("https://buy.stripe.com/"))).toBe(true);
    expect(new Set(checkoutUrls).size).toBe(12);
  });
});
