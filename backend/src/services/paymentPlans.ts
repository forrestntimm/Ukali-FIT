export type PaymentPlanCode =
  | "DROP_IN"
  | "MONTHLY"
  | "LADIES_CLASS_MONTHLY"
  | "ONE_WEEK_UNLIMITED"
  | "KIDS_CLASS"
  | "GOLD_MEMBER"
  | "YEAR_MEMBERSHIP"
  | "STUDENT_DISCOUNT_MONTHLY"
  | "GURKHA_DISCOUNT_MONTHLY";

export type PaymentPlanDurationUnit = "DAY" | "WEEK" | "MONTH" | "YEAR";

export type PaymentPlan = {
  code: PaymentPlanCode;
  name: string;
  amount: number;
  currency: "NPR";
  description: string;
  durationUnit: PaymentPlanDurationUnit;
  durationCount: number;
  quantityEnabled: boolean;
  category: "membership" | "per-class";
};

export const PAYMENT_PLANS: PaymentPlan[] = [
  {
    code: "DROP_IN",
    name: "Drop In",
    amount: 500,
    currency: "NPR",
    description: "Per class price.",
    durationUnit: "DAY",
    durationCount: 1,
    quantityEnabled: false,
    category: "per-class"
  },
  {
    code: "MONTHLY",
    name: "Monthly",
    amount: 3000,
    currency: "NPR",
    description: "Unlimited classes within the month.",
    durationUnit: "MONTH",
    durationCount: 1,
    quantityEnabled: false,
    category: "membership"
  },
  {
    code: "LADIES_CLASS_MONTHLY",
    name: "Ladies Class Monthly",
    amount: 2000,
    currency: "NPR",
    description: "For the month, Tuesday and Thursdays ladies classes only.",
    durationUnit: "MONTH",
    durationCount: 1,
    quantityEnabled: false,
    category: "membership"
  },
  {
    code: "ONE_WEEK_UNLIMITED",
    name: "1 Week Unlimited",
    amount: 1250,
    currency: "NPR",
    description: "Unlimited classes for a week.",
    durationUnit: "WEEK",
    durationCount: 1,
    quantityEnabled: false,
    category: "membership"
  },
  {
    code: "KIDS_CLASS",
    name: "Kids Class",
    amount: 200,
    currency: "NPR",
    description: "Per kid per class.",
    durationUnit: "DAY",
    durationCount: 1,
    quantityEnabled: true,
    category: "per-class"
  },
  {
    code: "GOLD_MEMBER",
    name: "Gold Member",
    amount: 6000,
    currency: "NPR",
    description: "Premium monthly membership.",
    durationUnit: "MONTH",
    durationCount: 1,
    quantityEnabled: false,
    category: "membership"
  },
  {
    code: "YEAR_MEMBERSHIP",
    name: "Year Membership",
    amount: 30000,
    currency: "NPR",
    description: "Unlimited classes for a year.",
    durationUnit: "YEAR",
    durationCount: 1,
    quantityEnabled: false,
    category: "membership"
  },
  {
    code: "STUDENT_DISCOUNT_MONTHLY",
    name: "Student Discount Monthly",
    amount: 1500,
    currency: "NPR",
    description: "Unlimited classes for the month. Must show student ID.",
    durationUnit: "MONTH",
    durationCount: 1,
    quantityEnabled: false,
    category: "membership"
  },
  {
    code: "GURKHA_DISCOUNT_MONTHLY",
    name: "Gurkha Discount Monthly",
    amount: 750,
    currency: "NPR",
    description: "Unlimited classes for the month. Must show Gurkha Academy ID.",
    durationUnit: "MONTH",
    durationCount: 1,
    quantityEnabled: false,
    category: "membership"
  }
];

export function listPaymentPlans() {
  return PAYMENT_PLANS;
}

export function getPaymentPlan(code: PaymentPlanCode | string) {
  return PAYMENT_PLANS.find((plan) => plan.code === code) || null;
}
