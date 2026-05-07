# Security Specification for FlowState

## Data Invariants
1. A user can only read and write their own profile document.
2. A user can only read and write transactions where `userId` matches their `uid`.
3. Transactions must have valid categories and methods.
4. Amounts must be numbers.
5. IDs must be valid strings.

## The Dirty Dozen Payloads (Targeting Rejection)
1. Write to another user's profile.
2. Create a transaction with another user's `userId`.
3. Update a transaction's `userId` after creation.
4. Create a transaction with a 1MB string in `notes`.
5. Create a transaction with an invalid category.
6. Delete another user's transaction.
7. Inject arbitrary fields into a user profile.
8. Set a transaction date to a future time (if disallowed).
9. Spoof `email_verified` (though we check auth).
10. Rapidly create 1000 transactions (rate limiting is hard in rules but we can check structural metadata).
11. Pass a non-numeric amount.
12. Use a document ID that is 2KB long.
