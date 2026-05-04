export interface FilterOptions {
  sortBy: "date" | "name" | "rating" | "date_taken" | "date_added" | "size";
  sortOrder: "asc" | "desc";
  minRating: number;
  selectedRatings: number[];
  selectedTags: string[];
  selectedLabels: string[];
  showLikedOnly: boolean;
  showHeroOnly: boolean;
  groupingLevel: "none" | "loose" | "medium" | "strict";
  selectedGroup: number | null;
}

export type GroupingLevel = "none" | "loose" | "medium" | "strict";

export const defaultFilters: FilterOptions = {
  sortBy: "name",
  sortOrder: "desc",
  minRating: 0,
  selectedRatings: [],
  selectedTags: [],
  selectedLabels: [],
  showLikedOnly: false,
  showHeroOnly: false,
  groupingLevel: "none",
  selectedGroup: null,
};
