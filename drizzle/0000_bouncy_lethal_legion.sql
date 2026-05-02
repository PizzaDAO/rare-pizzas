CREATE TABLE "listing_toppings" (
	"order_id" text NOT NULL,
	"topping_sku" integer NOT NULL,
	"rarity" text NOT NULL,
	CONSTRAINT "listing_toppings_order_id_topping_sku_pk" PRIMARY KEY("order_id","topping_sku")
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"order_id" text PRIMARY KEY NOT NULL,
	"order_data" jsonb NOT NULL,
	"collection" text NOT NULL,
	"token_contract" text NOT NULL,
	"chain_id" integer NOT NULL,
	"token_id" text NOT NULL,
	"seller" text NOT NULL,
	"price" text NOT NULL,
	"currency" text NOT NULL,
	"expiry" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"offer_id" text PRIMARY KEY NOT NULL,
	"order_data" jsonb NOT NULL,
	"collection" text NOT NULL,
	"token_contract" text NOT NULL,
	"chain_id" integer NOT NULL,
	"token_id" text,
	"offerer" text NOT NULL,
	"amount" text NOT NULL,
	"currency" text NOT NULL,
	"expiry" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "listing_toppings" ADD CONSTRAINT "listing_toppings_order_id_listings_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."listings"("order_id") ON DELETE cascade ON UPDATE no action;