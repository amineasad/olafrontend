import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface KpiValue {
  id: number;
  kpiCode: string;
  affiliate: string;
  month: string;
  year: number;
  value: number;
}
export interface ChartSeries {
  labels: string[];
  values: number[];
}

@Injectable({ providedIn: 'root' })
export class KpiService {
  private baseUrl = `${environment.apiUrl}/api`;
 // adapte si ton backend est sur un autre port

  constructor(private http: HttpClient) {}

  getAffiliates(): Observable<string[]> {
    return this.http.get<string[]>(`${this.baseUrl}/filters/affiliates`);
  }

  getYears(): Observable<number[]> {
    return this.http.get<number[]>(`${this.baseUrl}/filters/years`);
  }

  getMonths(affiliate: string, year: number): Observable<string[]> {
    const params = new HttpParams().set('affiliate', affiliate).set('year', year);
    return this.http.get<string[]>(`${this.baseUrl}/filters/months`, { params });
  }

getCategories(affiliate: string, year: number) {
  const params = new HttpParams().set('affiliate', affiliate).set('year', year);
  return this.http.get<string[]>(`${this.baseUrl}/filters/categories`, { params });
}

getKpis(affiliate: string, month: string, year: number, category?: string) {
  let params = new HttpParams()
    .set('affiliate', affiliate)
    .set('month', month)
    .set('year', year);

  if (category && category !== 'ALL') {
    params = params.set('category', category);
  }
  return this.http.get<KpiValue[]>(`${this.baseUrl}/kpis`, { params });
}
getKpisAverage(affiliate: string, year: number, category?: string) {
  let params = new HttpParams()
    .set('affiliate', affiliate)
    .set('year', year.toString());

  if (category) {
    params = params.set('category', category);
  }

  return this.http.get<KpiValue[]>(`${this.baseUrl}/kpis/average`, { params });
}

importKpis(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  return this.http.post(`${this.baseUrl}/kpis/import`, formData, { responseType: 'text' });
}
getMonthlySeries(affiliate: string, year: number, kpiCode: string, category?: string) {
  let params = new HttpParams()
    .set('affiliate', affiliate)
    .set('year', year.toString())
    .set('kpiCode', kpiCode);

  if (category && category !== 'ALL') {
    params = params.set('category', category);
  }

  return this.http.get<ChartSeries>(`${this.baseUrl}/kpis/series`, { params });
}
 getAiSummary(
    affiliate: string,
    year: number,
    category: string = 'ALL',
    month: string = 'ALL'
  ): Observable<{ summary: string; success: boolean }> {
    const params = new HttpParams()
      .set('affiliate', affiliate)
      .set('year', year.toString())
      .set('category', category)
      .set('month', month);

    return this.http.get<{ summary: string; success: boolean }>(
      `${this.baseUrl}/kpi/summary`,
      { params }
    );
  }
  
}
