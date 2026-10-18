# اتصال آنلاین هم‌سهم ۲.۴.۰

پروژه `ham hesab` با شناسه `repfhpczklxftloyffix` فعال است. سه migration این پوشه روی سرویس اعمال شده‌اند. شش جدول RLS دارند؛ public RPCها SECURITY INVOKER هستند و پیاده‌سازی‌های دارای سطح دسترسی مدیریتی در schema خصوصی قرار دارند و مالکیت/عضویت را داخل خود کنترل می‌کنند. Advisors امنیتی پس از استقرار هشدار نداشت.

در برنامه از «ورود و حساب آنلاین» وارد شوید. مدیر حساب ایمیلی خود را تأیید، صندوق آنلاین را به دفتر محلی متصل، شناسه را به اعضا بدهد و پس از بررسی هویت و تراکنش‌ها، پیش‌نمایش و انتشار را انجام دهد. ثبت‌نام اعضا و رسید ادعایی به‌تنهایی هیچ مجوزی ایجاد نمی‌کند. نشست ورود فقط در حافظه است. ثبت‌نام ایمیلی فعال و تأیید ایمیل لازم است؛ ارسال ایمیل و ورود واقعی هنوز تست نشده‌اند و محدودیت SMTP باید جدا بررسی شود.

فایل `online-config.js` فقط URL پروژه و کلید publishable عمومی دارد؛ کلید service-role/secret در مخزن یا APK نیست. ایمیل، رمز و نشست برای ما در چت لازم نیست. اطلاعات شخصی سایر اعضا داخل خلاصه عمومی ارسال نمی‌شود.

## انتشار انتخابی
`hamsahm_publish_snapshot` با کنترل مالکیت، قفل سطر صندوق، نسخه مورد انتظار و یک تراکنش پایگاه داده، خلاصه عمومی، حساب‌های مرتبط و سوابق تأیید را تطبیق می‌دهد. فقط اعضای approved تأیید پرداخت جدید می‌گیرند. سوابق معتبر عضو معلق/ردشده حفظ، ولی دسترسی او بسته می‌شود. ابطال واقعی پس از انتشار مجدد، تأیید قدیمی را باطل می‌کند؛ مرجع باطل‌شده قابل فعال‌کردن دوباره نیست. رقابت انتشار با نسخه قدیمی رد می‌شود. این فرایند دفتر کامل حسابداری یا همگام‌سازی خودکار چند دستگاه مدیر نیست.

## آزمون

```sh
npm --prefix supabase ci --ignore-scripts && npm --prefix supabase test
```

۵۷ بررسی روی PostgreSQL تعبیه‌شده PGlite انجام می‌شود؛ auth.uid و auth.users فقط در محیط تست شبیه‌سازی شده‌اند. تفکیک نقش‌ها، مجوز خواندن، جلوگیری از جعل تأیید، تعلیق، ابطال، محرمانگی حساب شخصی، تعارض نسخه، انتشار یکپارچه و برگشت کامل در خطا آزموده شده‌اند. این تست‌ها ایمیل، شبکه گوشی یا دو حساب واقعی Supabase را آزمایش نمی‌کنند. CI فقط آزمون را اجرا می‌کند و migration مستقر نمی‌کند.

## RPCها
- `hamsahm_create_fund(fund_name,payment_url)`
- `hamsahm_request_membership(fid,member_name)`
- `hamsahm_decide_membership(mid,new_status,member_key,reason)`
- `hamsahm_confirm_payment(mid,source_ref,payment_kind,payment_amount,paid_on)`
- `hamsahm_revoke_payment(cid,reason)`
- `hamsahm_my_access(fid)`
- `hamsahm_publish_snapshot(fid,expected_revision,fund_name,payment_link,summary,accounts,payments)`

نقش مدیر از مالکیت جدول و هویت auth.uid گرفته می‌شود، نه user_metadata. اجرا برای anon بسته است؛ SECURITY DEFINERهای خصوصی search_path خالی و کنترل هویت دارند. تصمیم‌ها و انتشار در audit نگه داشته می‌شوند. دعوت به معنای درخواست عضویت است و خودش اجازه دیدن صندوق نمی‌دهد.

مستندات رسمی: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)، [احراز هویت ایمیلی](https://supabase.com/docs/guides/auth/passwords)، [PGlite](https://pglite.dev/docs/).
