import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface AnomalyAlert {
  severity: 'attention' | 'critique';
  message: string;
}

export interface SeasonalAlert {
  kpi: string;
  message: string;
  deviation: number;
}

export interface TopContributor {
  feature: string;
  deviation: number;
  value: number;
  median: number;
  
}

export interface AnomalyResult {
  month: string; // ex: 2025-08
  ml_score: number;
  ml_anomaly: number;
  business_alerts: AnomalyAlert[];
  seasonal_anomaly: boolean;
  seasonal_alerts: SeasonalAlert[];
  top_contributors: TopContributor[];
  final_level: 'normal' | 'attention' | 'critique';
}

export interface AnomalyResponse {
  results: AnomalyResult[];
  model: string;
}

@Injectable({ providedIn: 'root' })
export class AnomalyService {
  private apiUrl = `${environment.apiUrl}/api/anomalies`;

  constructor(private http: HttpClient) {}

  getAnomalies(
    affiliate: string,
    years: number[],
    targetMonth?: string
  ): Observable<AnomalyResponse> {
    let params = new HttpParams()
      .set('affiliate', affiliate)
      .set('years', years.join(','));

    if (targetMonth) {
      params = params.set('targetMonth', targetMonth);
    }

    return this.http.get<AnomalyResponse>(this.apiUrl, { params });
  }
}