import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

import { LoginComponent } from './components/auth/login/login.component';
import { RegisterComponent } from './components/auth/register/register.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { LandingpageComponent } from './components/landingpage/landingpage.component';
import { AccueilComponent } from './components/accueil/accueil.component';
import { GraphesComponent } from './components/graphes/graphes.component';
import { DashboardMainComponent } from './components/dashboard-main/dashboard-main.component';
import { AdminUsersComponent } from './components/admin/admin-users.component';



@NgModule({
  declarations: [
    AppComponent,
    
    LoginComponent,
    RegisterComponent,
    DashboardComponent,
    LandingpageComponent,
    AccueilComponent,
    GraphesComponent,
    DashboardMainComponent,
    AdminUsersComponent,
    
    
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
     FormsModule,  
     BrowserAnimationsModule,      
    HttpClientModule 
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
