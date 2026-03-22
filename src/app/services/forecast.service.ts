import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface ForecastPrediction {
  month:     string;
  predicted: number;
  lower:     number;
  upper:     number;
}

export interface ForecastResult {
  affiliate:    string;
  kpi:          string;
  month:        string;
  predicted:    number;
  lower:        number;
  upper:        number;
  predictions:  ForecastPrediction[];
  trend:        string;
  trend_pct:    number;
  confidence:   number;
  quality:      string;
  cv_mape:      number;
  cv_mae:       number;
  history:      { month: string; value: number }[];
  model_info:   { algorithm: string; aic: number; n_train_months: number; order: string; seasonal_order: string };
  error?:       string;
}

@Injectable({ providedIn: 'root' })
export class ForecastService {
  private apiUrl = `${environment.apiUrl}/api/forecast`;

  constructor(private http: HttpClient) {}

  getForecast(affiliate: string, kpiCode: string, years: number[], periods: number = 1): Observable<ForecastResult> {
    const params = new HttpParams()
      .set('affiliate', affiliate)
      .set('kpiCode',   kpiCode)
      .set('years',     years.join(','))
      .set('periods',   periods.toString());
    return this.http.get<ForecastResult>(this.apiUrl, { params });
  }
}