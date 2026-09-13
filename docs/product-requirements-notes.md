### Customer registration and authentication

The storefront must support customer registration and sign-in using:

- email and password;
- Google account authentication.

Both authentication methods must remain available.

A customer account may be active on only one device/session at a time.
A successful sign-in on another device must invalidate the previous active session.

### Customer discount barcode

Upon successful customer registration, the system must generate a unique personal
discount barcode associated with the customer account.

The barcode is intended to identify the customer for discount or loyalty purposes,
including possible use in physical stores.

The exact discount and loyalty rules are not yet defined and must be agreed with the
client.

**OPEN:**

- barcode format;
- where and how the barcode is scanned in physical stores;
- whether it represents a fixed discount, loyalty membership or another benefit;
- whether discounts differ by customer;
- whether online and physical-store discounts share the same rules;
- whether the barcode can expire, be replaced or disabled;
- whether staff can manually assign or modify customer benefits.

Customer account
├── Email registration/login
├── Google login
├── One active session at a time
├── Personal discount barcode
└── Loyalty/discount rules — OPEN

### Account linking

A customer may create an account using email and password and later sign in with
Google using the same verified email address.

Both authentication methods must resolve to the same customer account rather than
creating duplicate accounts.

The customer must therefore retain a single account identity regardless of whether
they authenticate with:

- email and password;
- Google.

The account may have multiple authentication methods linked to it, while customer
profile data, order history, discount barcode and loyalty information remain shared.

### User roles

The system must support the following user roles:

- `user` — regular customer account;
- `editor` — staff member responsible for operational content and/or store management;
- `admin` — full administrative access.

Exact permissions for `editor` and `admin` must be defined during backoffice discovery.
