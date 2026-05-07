export type Category = 'Food' | 'Transport' | 'Shopping' | 'Entertainment' | 'Bills' | 'Income' | 'Other';
export type PaymentMethod = 'Cash' | 'Card' | 'Online Payment';

export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  category: Category;
  method: PaymentMethod;
  date: string;
  notes: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  balance: number;
  monthlyBudget: number;
}
