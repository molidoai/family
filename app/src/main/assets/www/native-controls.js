export function installNativeControls(content,esc,fmt){
 if(!window.HamsahmNative?.securityInfo)return;
 const security=JSON.parse(window.HamsahmNative.securityInfo()),panel=document.createElement('div');panel.className='panel';
 panel.innerHTML=`<h2>امنیت و یادآوری</h2><label class="nativeAuto"><input id="appLock" type="checkbox" ${security.locked?'checked':''}> قفل ورود با رمز یا اثر انگشت گوشی</label><p class="hint">پس از خروج از برنامه، ورود دوباره به تأیید هویت نیاز دارد. اثر انگشت در اندروید ۱۰ به بالا و دستگاه پشتیبان، و رمز یا الگوی گوشی در اندروید ۷ به بالا قابل استفاده است. با فعال‌بودن قفل، عکس‌گرفتن از صفحه مسدود می‌شود.</p>${security.locked?'<button id="lockNow" type="button">قفل‌کردن اکنون</button>':''}<hr><label class="nativeAuto"><input id="remindersEnabled" type="checkbox" ${security.reminders?'checked':''}> یادآوری محلی سهم و اقساط</label><label>ساعت یادآوری روزانه<select id="reminderHour">${Array.from({length:24},(_,h)=>`<option value="${h}" ${h===security.hour?'selected':''}>${fmt(h)}:۰۰</option>`).join('')}</select></label><div class="actions"><button id="saveReminders" type="button" class="primary">ذخیره یادآوری</button><button id="testReminder" type="button">اعلان آزمایشی</button></div><p class="hint">${security.notificationsAllowed?'اجازه اعلان فعال است.':'اجازه اعلان در اندروید هنوز فعال نیست.'} زمان نمایش تقریبی است و به تنظیمات باتری گوشی بستگی دارد. یادآوری از آخرین اطلاعات ذخیره‌شده استفاده می‌کند؛ سهم ماهانه در پایان همان ماه سررسید می‌شود.</p>`;
 content.prepend(panel);const $=s=>panel.querySelector(s);
 $('#appLock').onchange=e=>window.HamsahmNative.setAppLock(e.target.checked);
 $('#lockNow')?.addEventListener('click',()=>window.HamsahmNative.lockNow());
 $('#saveReminders').onclick=()=>window.HamsahmNative.configureReminders($('#remindersEnabled').checked,Number($('#reminderHour').value));
 $('#testReminder').onclick=()=>window.HamsahmNative.testReminder();
}
