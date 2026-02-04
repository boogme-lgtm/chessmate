import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Globe, Star, Clock } from "lucide-react";
import { motion } from "framer-motion";

export type TimeSlot = "morning" | "afternoon" | "evening" | "weekend";
export type DayOfWeek = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

export interface DetailedAvailability {
  days: DayOfWeek[];
  timeSlots: TimeSlot[];
  timezoneOffset: number; // UTC offset in hours (e.g., -8 for PST, +1 for CET)
}

export interface CoachProfile {
  id: string;
  name: string;
  title: string;
  rating: number;
  location: string;
  timezone: string;
  languages: string[];
  hourlyRate: number;
  imageUrl: string;
  specializations: string[];
  teachingStyle: string;
  targetRating: string;
  availability: string; // Human-readable summary
  detailedAvailability: DetailedAvailability;
  studentCount?: number;
  reviewRating?: number;
  bio: string;
}

interface CoachProfileCardProps {
  coach: CoachProfile;
  onBookClick?: () => void;
}

export function CoachProfileCard({ coach, onBookClick }: CoachProfileCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
    >
      <Card className="palantir-card overflow-hidden h-full hover:border-foreground/20 transition-all duration-300">
        <CardContent className="p-0">
          {/* Coach Image */}
          <div className="relative h-80 overflow-hidden bg-muted">
            <img
              src={coach.imageUrl}
              alt={coach.name}
              className="w-full h-full object-cover object-center"
            />
            <div className="absolute top-4 right-4 flex gap-2">
              <Badge className="bg-background/90 text-foreground border-border">
                {coach.title}
              </Badge>
            </div>
          </div>

          {/* Coach Info */}
          <div className="p-6 space-y-4">
            {/* Name and Rating */}
            <div>
              <h3 className="text-2xl font-light mb-1">{coach.name}</h3>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="font-mono">{coach.rating} FIDE</span>
                {coach.reviewRating && (
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-foreground text-foreground" />
                    <span>{coach.reviewRating.toFixed(1)}</span>
                  </div>
                )}
                {coach.studentCount && (
                  <span>{coach.studentCount}+ students</span>
                )}
              </div>
            </div>

            {/* Location and Languages */}
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                <span>{coach.location}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Globe className="w-4 h-4" />
                <span>{coach.languages.join(", ")}</span>
              </div>
            </div>

            {/* Bio */}
            <p className="text-sm font-light text-muted-foreground leading-relaxed line-clamp-3">
              {coach.bio}
            </p>

            {/* Specializations */}
            <div className="flex flex-wrap gap-2">
              {coach.specializations.slice(0, 3).map((spec, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className="bg-transparent font-light text-xs"
                >
                  {spec}
                </Badge>
              ))}
            </div>

            {/* Teaching Details */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/50">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Teaching Style</div>
                <div className="text-sm font-light">{coach.teachingStyle}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Target Rating</div>
                <div className="text-sm font-light">{coach.targetRating}</div>
              </div>
            </div>

            {/* Availability and Price */}
            <div className="flex items-center justify-between pt-4 border-t border-border/50">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>{coach.availability}</span>
              </div>
              <div className="text-right">
                <div className="text-2xl font-light">${coach.hourlyRate}</div>
                <div className="text-xs text-muted-foreground">per hour</div>
              </div>
            </div>

            {/* Book Button */}
            <Button
              onClick={onBookClick}
              className="w-full btn-primary"
              size="lg"
            >
              Book Lesson
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
