CREATE TABLE "ens_cache" (
	"wallet" text PRIMARY KEY NOT NULL,
	"ens_name" text,
	"ens_avatar" text,
	"resolved_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leaderboard_holders" (
	"snapshot_id" text NOT NULL,
	"wallet" text NOT NULL,
	"pizza_count" integer DEFAULT 0 NOT NULL,
	"box_count" integer DEFAULT 0 NOT NULL,
	"total_nfts" integer DEFAULT 0 NOT NULL,
	"rarity_score" integer DEFAULT 0 NOT NULL,
	"unique_toppings" integer DEFAULT 0 NOT NULL,
	"completeness_score" integer DEFAULT 0 NOT NULL,
	"ens_name" text,
	"ens_avatar" text,
	"rank_by_total" integer,
	"rank_by_rarity" integer,
	"rank_by_completeness" integer,
	CONSTRAINT "leaderboard_holders_snapshot_id_wallet_pk" PRIMARY KEY("snapshot_id","wallet")
);
--> statement-breakpoint
CREATE TABLE "leaderboard_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"status" text DEFAULT 'running' NOT NULL,
	"holder_count" integer,
	"token_count" integer
);
--> statement-breakpoint
ALTER TABLE "leaderboard_holders" ADD CONSTRAINT "leaderboard_holders_snapshot_id_leaderboard_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."leaderboard_snapshots"("id") ON DELETE cascade ON UPDATE no action;