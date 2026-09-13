# Product requirements

Status: **discovery / working draft**

This document captures the product direction, confirmed business requirements,
design principles, and open questions for the new `sokoladomeistrai.lt` storefront.

The goal is to define the product before domain modelling or implementation begins.
Unknown requirements must remain explicitly marked as **OPEN** and must not be invented.

---

## 1. Product vision

The new `sokoladomeistrai.lt` storefront should represent **Šokolado Meistrai as a
premium-segment brand**, not merely provide a functional online shopping interface.

The company sells premium-quality chocolate, confectionery, tea, coffee and
complementary gift/lifestyle products.

The current storefront is visually dated, slow and does not adequately communicate
the quality of the products or the brand.

The new product should therefore combine:

- familiar modern e-commerce behaviour;
- premium visual presentation;
- strong product photography;
- mobile-first UX;
- fast, clear and restrained interaction design;
- business-specific flows only where Šokolado Meistrai genuinely needs them.

### Product design principle: pragmatic automation

The system should automate repetitive and predictable parts of the customer journey,
while preserving human interaction where bespoke confectionery work reasonably
requires clarification, interpretation or creative judgement.

The goal is not to eliminate staff involvement, but to reduce unnecessary manual work
without making the customer experience rigid or over-engineered.

The product should follow familiar e-commerce interaction patterns wherever possible,
while introducing custom flows only where Šokolado Meistrai business processes
genuinely require them.

---

## 2. Functional scope

### 2.1 Standard e-commerce capabilities

The storefront is expected to provide familiar modern e-commerce functionality,
including:

- product catalog;
- categories;
- search;
- filtering;
- sorting;
- product detail pages;
- cart;
- checkout;
- payments;
- delivery selection;
- order confirmation and notifications;
- guest checkout and/or customer account capabilities;
- promotions, discounts and coupons.

Exact rules for these areas are still subject to discovery.

### 2.2 Product availability by sales channel

The system must support products that are:

- available for purchase online and in physical stores;
- available only in physical stores but still visible in the online catalog.

Products unavailable for online purchase must remain discoverable and fully
presentable, but must not expose regular online purchase actions.

The customer-facing interface must clearly communicate the applicable sales channel
and must not present physical-store-only products as "out of stock".

### 2.3 Physical store availability

The company operates several physical stores in Vilnius and one in Kaunas.

Product assortment is generally consistent across physical locations. Therefore,
the first release does not require store-level inventory or availability tracking
unless further discovery reveals a real business need.

### 2.4 Product variants

Some products have selectable variants, for example:

- dark chocolate;
- milk chocolate.

A variant may affect price, availability, SKU or other product properties.

**OPEN:** exact variant rules.

### 2.5 Made-to-order confectionery

Some higher-value products, especially selected cakes, are produced only after an
advance order.

These products are not regular online-store items and are not shipped through the
standard parcel-delivery flow.

Instead of the standard "Add to cart" action, the product page should expose an
"Order" action.

The ordering flow must allow the customer to specify at least:

- requested date;
- approximate target weight;
- pickup or supported local delivery;
- other product-specific options where applicable.

The customer must pay in advance before production begins.

#### Approximate weight

Handmade confectionery cannot be produced to an exact gram weight.

The customer selects a target size, for example:

- approximately 1 kg;
- approximately 1.5 kg;
- approximately 2 kg.

The selected size determines the expected product size and price, while the actual
finished weight may vary within an acceptable production tolerance.

The ordering flow must clearly communicate that the selected weight is approximate.

**OPEN:**

- minimum lead time;
- acceptable weight tolerance;
- supported delivery area;
- delivery pricing;
- cancellation/refund rules.

### 2.6 Occasion cakes

The store must provide a dedicated **Occasion Cakes** page.

The page should:

- present example occasion cakes for inspiration;
- explain the ordering process;
- allow the customer to select a base cake from the existing non-online cake assortment;
- allow approximate weight selection;
- allow decoration selection;
- allow custom inscription text;
- allow image upload when edible print is selected;
- allow requested date selection;
- allow pickup or supported local delivery;
- calculate and display the current order price from the selected options;
- require advance payment before the order is submitted for production.

Example decoration options may include:

- flowers;
- edible print;
- custom inscription.

If production staff require clarification, they may contact the customer directly
using the contact details supplied with the order.

The system should not attempt to replace reasonable human clarification in bespoke
confectionery production.

---

## 3. Markets, language and delivery

### 3.1 Markets and languages

The current customer base includes Lithuanians living abroad.

The initial target market is Lithuania, but multilingual support may create an
opportunity to serve a wider international audience.

Potential storefront languages:

- Lithuanian;
- English;
- Russian.

Multilingual capability should be treated as a product requirement even if not all
languages are included in the first release.

**OPEN:** languages included in v1.

### 3.2 Delivery

Omniva is currently used for standard product delivery.

**OPEN:**

- parcel terminal rules;
- courier delivery, if applicable;
- supported countries;
- international delivery;
- delivery pricing;
- free-delivery thresholds;
- delivery times;
- order/product restrictions;
- delivery rules for made-to-order products.

---

## 4. Design and UX direction

The storefront must be designed **mobile-first**.

The visual experience should reflect a **premium confectionery brand** rather than a
generic online shop.

The product itself — chocolate, confectionery, coffee, tea and gift items — should
remain the primary visual focus.

### 4.1 Visual principles

The design should be:

- modern;
- warm;
- elegant;
- visually rich without being crowded;
- easy to scan and navigate;
- strongly product-led;
- consistent with a premium-segment brand.

The design should communicate **quality, craftsmanship and indulgence before the
customer reads a single product description**.

### 4.2 Product photography

Product photography is a primary sales asset.

**The product image should sell the product, while the interface should stay out of
its way.**

For a premium confectionery brand, low-quality, poorly lit or inconsistent product
photography directly weakens perceived product quality and brand value.

The storefront should therefore rely on:

- high-quality, appetising product photography;
- consistent lighting and visual treatment;
- clean or deliberately styled compositions;
- suitable crops for product cards and product detail pages;
- sufficiently high source resolution for modern displays.

The perceived quality of the product cannot be higher than the perceived quality of
its presentation.

### 4.3 Colour direction

The visual palette should remain intentionally restrained.

Brand colours:

- Chocolate — `#522C1B`
- Caramel — `#B07E5B`
- Cream — `#EBDCCD`

Supporting neutrals:

- Ivory — `#FAF7F4`
- Ink — `#2B211C`
- Muted — `#75655D`
- Border — `#E7DDD6`

Suggested roles:

- Background → Ivory
- Cards / sections → White or Cream, used sparingly
- Primary text → Ink
- Headings / accent → Chocolate
- Primary CTA → Chocolate
- Secondary accent → Caramel
- Borders → Border
- Muted text → Muted

Colour should frame the product photography, not compete with it.

### 4.4 Typography direction

A handwritten display typeface such as **Kalam** may be used selectively for
headlines, campaign accents or short expressive phrases.

Functional interface typography — navigation, product information, prices, filters,
forms and checkout — should use a neutral, highly readable sans-serif typeface.

The goal is to preserve warmth and craftsmanship without drifting into an overly
rustic or "homemade" visual style.

### 4.5 Mobile-first principle

The primary customer experience must be designed for mobile devices first and then
expanded for larger screens.

Navigation, product discovery, product pages, cart and checkout must remain clear and
convenient on small screens.

---

## 5. Open functional areas

The following areas still require discovery before detailed product requirements can
be finalised:

### Cart

**OPEN:** persistence, guest/account behaviour, cart rules.

### Checkout and orders

**OPEN:** checkout fields, guest checkout, order states, order history.

### Payments

**OPEN:** payment provider(s), supported payment methods, currency.

### Accounts / authentication

**OPEN:** whether customer accounts are required, optional or post-purchase.

### Admin / backoffice

**OPEN:** product, order, content and customer management workflows.

### Search and navigation

**OPEN:** filtering dimensions, category structure, search behaviour.

### Localization and compliance

**OPEN:** VAT/tax rules, GDPR/cookies, legal texts, invoice requirements.

### Media / uploads

**OPEN:** product media workflow, storage rules, occasion-cake upload requirements.

### Marketing and analytics

**OPEN:** analytics, SEO, email marketing, abandoned carts, remarketing, loyalty.

---

## 6. Discovery questions for the client

Questions should be asked in small thematic groups rather than as one large
questionnaire.

Current priority questions:

1. Which payment methods and payment provider(s) are used or preferred?
2. What exactly does Omniva delivery support today: parcel terminals, courier,
   international delivery?
3. What are the minimum lead times for made-to-order and occasion cakes?
4. Which pickup locations and local-delivery areas are supported?
5. What customer account functionality is actually needed?
6. What promotions, coupons or discount rules are used today?
7. What are the current product/category/filter structures that customers actually use?
8. What admin tasks are performed most frequently by staff?
