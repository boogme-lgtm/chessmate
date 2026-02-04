import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { X } from "lucide-react";
import { motion } from "framer-motion";

export interface FilterState {
  priceRange: [number, number];
  minRating: number | null;
  specializations: string[];
}

interface CoachFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  availableSpecializations: string[];
}

export function CoachFilters({
  filters,
  onFiltersChange,
  availableSpecializations,
}: CoachFiltersProps) {
  const handlePriceChange = (value: number[]) => {
    onFiltersChange({
      ...filters,
      priceRange: [value[0], value[1]],
    });
  };

  const handleRatingChange = (rating: number | null) => {
    onFiltersChange({
      ...filters,
      minRating: rating,
    });
  };

  const handleSpecializationToggle = (specialization: string) => {
    const newSpecializations = filters.specializations.includes(specialization)
      ? filters.specializations.filter((s) => s !== specialization)
      : [...filters.specializations, specialization];

    onFiltersChange({
      ...filters,
      specializations: newSpecializations,
    });
  };

  const handleReset = () => {
    onFiltersChange({
      priceRange: [0, 200],
      minRating: null,
      specializations: [],
    });
  };

  const hasActiveFilters =
    filters.priceRange[0] !== 0 ||
    filters.priceRange[1] !== 200 ||
    filters.minRating !== null ||
    filters.specializations.length > 0;

  const ratingOptions = [
    { value: null, label: "All Ratings" },
    { value: 4.5, label: "4.5+ Stars" },
    { value: 4.7, label: "4.7+ Stars" },
    { value: 4.9, label: "4.9+ Stars" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="palantir-card">
        <CardContent className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-light">Filter Coaches</h3>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="text-xs font-light text-muted-foreground hover:text-foreground"
              >
                Reset All
              </Button>
            )}
          </div>

          {/* Price Range */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-light text-muted-foreground">
                Price Range
              </label>
              <span className="text-sm font-mono text-foreground">
                ${filters.priceRange[0]} - ${filters.priceRange[1]}
              </span>
            </div>
            <Slider
              min={0}
              max={200}
              step={5}
              value={filters.priceRange}
              onValueChange={handlePriceChange}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground font-light">
              <span>$0</span>
              <span>$200+</span>
            </div>
          </div>

          {/* Rating Filter */}
          <div className="space-y-3">
            <label className="text-sm font-light text-muted-foreground">
              Minimum Rating
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ratingOptions.map((option) => (
                <Button
                  key={option.label}
                  variant={filters.minRating === option.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleRatingChange(option.value)}
                  className={`font-light text-xs ${
                    filters.minRating === option.value
                      ? "bg-foreground text-background hover:bg-foreground/90"
                      : "bg-transparent"
                  }`}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Specializations */}
          <div className="space-y-3">
            <label className="text-sm font-light text-muted-foreground">
              Specializations
            </label>
            <div className="flex flex-wrap gap-2">
              {availableSpecializations.map((spec) => {
                const isSelected = filters.specializations.includes(spec);
                return (
                  <Badge
                    key={spec}
                    variant={isSelected ? "default" : "outline"}
                    className={`cursor-pointer font-light text-xs transition-all ${
                      isSelected
                        ? "bg-foreground text-background hover:bg-foreground/90"
                        : "bg-transparent hover:bg-foreground/10"
                    }`}
                    onClick={() => handleSpecializationToggle(spec)}
                  >
                    {spec}
                    {isSelected && <X className="w-3 h-3 ml-1" />}
                  </Badge>
                );
              })}
            </div>
          </div>

          {/* Active Filters Summary */}
          {hasActiveFilters && (
            <div className="pt-4 border-t border-border/50">
              <div className="text-xs text-muted-foreground font-light">
                {filters.specializations.length > 0 && (
                  <span>{filters.specializations.length} specialization(s)</span>
                )}
                {filters.minRating && (
                  <span>
                    {filters.specializations.length > 0 && " • "}
                    {filters.minRating}+ rating
                  </span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
