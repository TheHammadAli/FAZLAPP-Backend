import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class SearchService {
  private readonly AUTOCOMPLETE_URL =
    "https://maps.googleapis.com/maps/api/place/autocomplete/json";
  private readonly DETAILS_URL =
    "https://maps.googleapis.com/maps/api/place/details/json";

  constructor(private readonly configService: ConfigService) {}

  async autocompleteLocations(input: string) {
    const apiKey = this.configService.getOrThrow<string>(
      "GOOGLE_LOCATION_API_KEY",
    );

    const params = new URLSearchParams({
      input,
      key: apiKey,
      language: "en",
      components: "country:pk", // optional: restrict to Pakistan
    });

    const res = await fetch(`${this.AUTOCOMPLETE_URL}?${params.toString()}`);
    if (!res.ok) throw new Error(`Google API error: ${res.statusText}`);
    const data = await res.json();

    // Get coordinates for each prediction
    const enriched = await Promise.all(
      data.predictions.map(async (p: any) => {
        const coords = await this.getCoordinates(p.place_id, apiKey);
        return {
          description: p.description,
          place_id: p.place_id,
          coordinates: coords,
        };
      }),
    );

    return enriched;
  }

  private async getCoordinates(placeId: string, apiKey: string) {
    const params = new URLSearchParams({
      place_id: placeId,
      key: apiKey,
      fields: "geometry", // limit response only to geometry
    });

    const res = await fetch(`${this.DETAILS_URL}?${params.toString()}`);
    if (!res.ok) throw new Error(`Google API error: ${res.statusText}`);
    const data = await res.json();

    return data.result?.geometry?.location ?? null;
  }
}
