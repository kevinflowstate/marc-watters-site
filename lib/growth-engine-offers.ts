export type GrowthEngineRegion = "uk" | "ireland";

export interface GrowthEnginePrice {
  firstPayment: string;
  thenMonthly?: string;
  paymentType: "recurring" | "one-off";
  checkoutUrl: string;
}

export interface GrowthEngineRegionOffers {
  label: string;
  shortLabel: string;
  taxNote: string;
  priceSuffix?: string;
  leadGeneration: GrowthEnginePrice;
  receptionist: GrowthEnginePrice;
  webinar: GrowthEnginePrice;
  websites: {
    a: GrowthEnginePrice;
    b: GrowthEnginePrice;
    c: GrowthEnginePrice;
  };
}

export const GROWTH_ENGINE_OFFERS: Record<GrowthEngineRegion, GrowthEngineRegionOffers> = {
  uk: {
    label: "United Kingdom",
    shortLabel: "UK",
    taxNote: "Pricing subject to UK VAT",
    priceSuffix: "+ VAT",
    leadGeneration: {
      firstPayment: "£2,225",
      thenMonthly: "£1,250/month",
      paymentType: "recurring",
      checkoutUrl: "https://buy.stripe.com/dRm5kFaYQ1sAgGv6rW97G02",
    },
    receptionist: {
      firstPayment: "£699",
      thenMonthly: "£199/month",
      paymentType: "recurring",
      checkoutUrl: "https://buy.stripe.com/3cI5kF2skfjq9e39E897G0e",
    },
    webinar: {
      firstPayment: "£8,250",
      paymentType: "one-off",
      checkoutUrl: "https://buy.stripe.com/eVqcN74As0ow61R03y97G08",
    },
    websites: {
      a: {
        firstPayment: "£995",
        paymentType: "one-off",
        checkoutUrl: "https://buy.stripe.com/5kQdRbd6Y3AIfCr3fK97G0a",
      },
      b: {
        firstPayment: "£2,495",
        paymentType: "one-off",
        checkoutUrl: "https://buy.stripe.com/6oU7sN8QI8V289Z4jO97G0c",
      },
      c: {
        firstPayment: "£3,349",
        thenMonthly: "£99/month",
        paymentType: "recurring",
        checkoutUrl: "https://buy.stripe.com/8x228t8QIefmai75nS97G0g",
      },
    },
  },
  ireland: {
    label: "Republic of Ireland",
    shortLabel: "ROI",
    taxNote: "No VAT applicable",
    leadGeneration: {
      firstPayment: "£2,225",
      thenMonthly: "£1,250/month",
      paymentType: "recurring",
      checkoutUrl: "https://buy.stripe.com/eVq00l5Ew8V24XN03y97G03",
    },
    receptionist: {
      firstPayment: "£699",
      thenMonthly: "£199/month",
      paymentType: "recurring",
      checkoutUrl: "https://buy.stripe.com/9B66oJ4As7QYfCr3fK97G0f",
    },
    webinar: {
      firstPayment: "£8,250",
      paymentType: "one-off",
      checkoutUrl: "https://buy.stripe.com/6oUfZj2skc7e2PFcQk97G09",
    },
    websites: {
      a: {
        firstPayment: "£995",
        paymentType: "one-off",
        checkoutUrl: "https://buy.stripe.com/8x2fVjaYQ0owfCr8A497G0b",
      },
      b: {
        firstPayment: "£2,495",
        paymentType: "one-off",
        checkoutUrl: "https://buy.stripe.com/eVq9AV3wo6MU89Z6rW97G0d",
      },
      c: {
        firstPayment: "£3,349",
        thenMonthly: "£99/month",
        paymentType: "recurring",
        checkoutUrl: "https://buy.stripe.com/00weVf7ME2wEbmb9E897G0h",
      },
    },
  },
};
