CREATE INDEX "activities_trip_idx" ON "activities" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "availabilities_trip_idx" ON "availabilities" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "destinations_trip_idx" ON "destinations" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "documents_trip_idx" ON "documents" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "events_day_idx" ON "events" USING btree ("day_id");--> statement-breakpoint
CREATE INDEX "itinerary_days_trip_idx" ON "itinerary_days" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "messages_trip_idx" ON "messages" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "photos_trip_idx" ON "photos" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "trip_members_user_idx" ON "trip_members" USING btree ("user_id");