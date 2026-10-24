alter table public.shop_settings
    alter column shop_name set default 'QT Fashion app';

update public.shop_settings
set shop_name = 'QT Fashion app'
where shop_name = 'OTI B Fashion Shop';
