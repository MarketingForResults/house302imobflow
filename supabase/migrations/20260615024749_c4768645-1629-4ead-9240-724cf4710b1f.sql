alter table public.app_settings
  add column if not exists locale_country text not null default 'BR',
  add column if not exists locale_language text not null default 'pt-BR',
  add column if not exists locale_timezone text not null default 'America/Sao_Paulo';

alter table public.app_settings
  drop constraint if exists app_settings_locale_country_check,
  add constraint app_settings_locale_country_check
    check (locale_country in ('BR', 'PT', 'US'));

alter table public.app_settings
  drop constraint if exists app_settings_locale_language_check,
  add constraint app_settings_locale_language_check
    check (locale_language in ('pt-BR', 'pt-PT', 'en-US'));

alter table public.app_settings
  drop constraint if exists app_settings_locale_timezone_check,
  add constraint app_settings_locale_timezone_check
    check (locale_timezone in ('America/Sao_Paulo', 'America/Manaus', 'America/Recife', 'America/Cuiaba', 'Europe/Lisbon', 'UTC'));