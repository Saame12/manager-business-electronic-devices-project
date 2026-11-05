/* app1.js - toàn bộ xử lý của cửa hàng linh kiện PC */
/* TOÀN BỘ CHƯƠNG TRÌNH nằm trong một hàm tự chạy (IIFE) để các biến không lọt ra ngoài trang.
   'use strict' bật chế độ chặt chẽ, báo lỗi sớm khi viết sai.
   Trình tự: (1) hàm tiện ích -> (2) dữ liệu mẫu -> (3) hàm vẽ giao diện -> (4) ngăn kéo/hộp thoại -> (5) mục 3.2 -> (6) lắng nghe sự kiện -> (7) chạy lần đầu. */
(async function(){
'use strict';
/* DAY = số mili giây của 1 ngày. NOW = thời điểm mở trang, dùng để tính ngày tồn kho và hạn bảo hành. */
var DAY=86400000, NOW=new Date();
/* daysAgo(n): trả về ngày cách đây n ngày (dùng để tạo dữ liệu mẫu có ngày hợp lý). */
function daysAgo(n){return new Date(NOW.getTime()-n*DAY)}
/* pad(n): thêm số 0 phía trước cho đủ 2 chữ số (5 -> "05"). */
function pad(n){return String(n).padStart(2,'0')}
/* fmtDate(d): định dạng ngày kiểu Việt Nam dd/mm/yyyy. */
function fmtDate(d){d=new Date(d);return pad(d.getDate())+'/'+pad(d.getMonth()+1)+'/'+d.getFullYear()}
/* fmtTime(d): ngày + giờ phút, dùng trong nhật ký điều chỉnh tồn. */
function fmtTime(d){d=new Date(d);return fmtDate(d)+' '+pad(d.getHours())+':'+pad(d.getMinutes())}
/* money(n): hiển thị tiền kiểu Việt Nam, ví dụ 4590000 -> "4.590.000 đ". */
function money(n){return new Intl.NumberFormat('vi-VN').format(Math.round(n))+' đ'}
/* esc(s): chuyển ký tự đặc biệt (<, >, &, ") thành mã an toàn trước khi chèn vào HTML. Mọi dữ liệu người dùng nhập đều phải qua hàm này để tránh lỗi hiển thị và chèn mã độc. */
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
/* $(id): viết tắt của document.getElementById. */
function $(id){return document.getElementById(id)}

/* ===== DỮ LIỆU 3.2 =====
   CATS: cây loại (mảng phẳng). BRANDS: danh sách thương hiệu. nextCat/nextBrand: id cấp cho mục mới.
   Dữ liệu chỉ nằm trong bộ nhớ trang, tải lại sẽ về dữ liệu mẫu bên dưới. */
var CATS=[],BRANDS=[],nextCat=100,nextBrand=100;
(function(){
 function mk(id,code,name,parent,desc,specs){CATS.push({id:id,code:code,name:name,parent:parent,desc:desc,active:true,specs:specs})}
 mk(1,'CPU','CPU',null,'Bộ vi xử lý trung tâm',['Socket','Số nhân / luồng','Xung nhịp']);
 mk(2,'MAIN','Bo mạch chủ',null,'Mainboard các chuẩn kích thước',['Socket','Chipset','Loại RAM hỗ trợ','Kích thước']);
 mk(3,'RAM','RAM',null,'Bộ nhớ trong cho PC',['Dung lượng','Tốc độ (Bus)','Chuẩn RAM']);
 mk(4,'DRIVE','Ổ cứng',null,'Nhóm lưu trữ: SSD và HDD',['Dung lượng','Chuẩn kết nối']);
 mk(5,'SSD','Ổ cứng SSD',4,'Ổ thể rắn SATA và NVMe',['Tốc độ đọc']);
 mk(6,'HDD','Ổ cứng HDD',4,'Ổ cứng cơ học',['Tốc độ quay']);
 mk(7,'VGA','Card đồ họa (VGA)',null,'Card màn hình rời',['Bộ nhớ','Chuẩn kết nối','Nguồn khuyến nghị']);
 mk(8,'PSU','Nguồn máy tính',null,'Bộ nguồn ATX',['Công suất','Chuẩn hiệu suất','Kiểu dây']);
 mk(9,'CASE','Vỏ case',null,'Thùng máy các cỡ',['Kích thước','Hỗ trợ mainboard','Số quạt kèm theo']);
 mk(10,'COOL','Tản nhiệt',null,'Tản khí và tản nước',['Loại tản','Socket hỗ trợ','Chiều cao']);
 mk(11,'LCD','Màn hình',null,'Màn hình máy tính',['Kích thước','Độ phân giải','Tần số quét']);
 mk(12,'ACC','Phụ kiện',null,'Phụ kiện và thiết bị ngoại vi',['Chuẩn kết nối','Chiều dài']);
 mk(13,'MOUSE','Chuột',12,'Chuột có dây và không dây',[]);
 mk(14,'CABLE','Cáp - Dây nối',12,'Cáp dữ liệu, cáp nguồn',[]);
 ['Intel','AMD','Nvidia','ASUS','MSI','Gigabyte','Kingston','Corsair','Samsung','Western Digital','Deepcool','NZXT','LG','Logitech','Ugreen'].forEach(function(n,i){BRANDS.push({id:i+1,name:n})});
})();
/* STATUSES: 3 trạng thái người dùng được đặt tay. Trạng thái 'Hết hàng' không nằm ở đây vì tự suy ra khi tồn kho bằng 0 (xem hàm eff). */
var STATUSES=['Đang kinh doanh','Tạm ngừng bán','Ngừng kinh doanh'];

/* P(...): hàm dựng một sản phẩm mẫu. Mỗi sản phẩm có: id, tên, SKU, mã vạch, loại, hãng, giá bán, bảo hành (tháng), thông số [[tên, giá trị]], serial (có quản lý theo Serial không), min (mức cảnh báo tồn), stock (tồn), status, hasData (đã có giao dịch chưa; nếu có thì không được xóa) và hist (lịch sử đổi giá). */
function P(id,name,sku,bar,type,brand,price,warranty,specs,serial,min,stock,status,hasData){
  return {id:id,name:name,sku:sku,barcode:bar,type:type,brand:brand,price:price,img:'',warranty:warranty,specs:specs,serial:serial,min:min,stock:stock,status:status||'Đang kinh doanh',hasData:hasData!==false,
    hist:hasData===false?[]:[{d:daysAgo(60+id*7).getTime(),from:Math.round(price*1.04/1000)*1000,to:price}]};
}
/* DANH SÁCH SẢN PHẨM MẪU. Đây là "cơ sở dữ liệu" tạm trong bộ nhớ; tải lại trang sẽ trở về dữ liệu này. */
var products=[
 P(1,'Intel Core i5-14400F','CPU-I514400F','8935001200011','CPU','Intel',4590000,36,[['Socket','LGA1700'],['Số nhân / luồng','10 nhân / 16 luồng'],['Xung nhịp','Tối đa 4.7 GHz']],true,5,12),
 P(2,'AMD Ryzen 5 7600X','CPU-R57600X','8935001200028','CPU','AMD',5890000,36,[['Socket','AM5'],['Số nhân / luồng','6 nhân / 12 luồng'],['Xung nhịp','Tối đa 5.3 GHz']],true,5,3),
 P(3,'ASUS PRIME B760M-A WIFI D4','MB-B760MA-D4','8935001200035','Bo mạch chủ','ASUS',3290000,36,[['Socket','LGA1700'],['Chipset','B760'],['Loại RAM hỗ trợ','DDR4'],['Kích thước','Micro-ATX']],true,4,8),
 P(4,'Kingston Fury Beast 16GB DDR4 3200','RAM-KF16-3200','8935001200042','RAM','Kingston',790000,36,[['Dung lượng','16GB (1 thanh)'],['Tốc độ (Bus)','3200 MHz'],['Chuẩn RAM','DDR4']],false,15,40),
 P(5,'Samsung 980 PRO 1TB NVMe','SSD-980P-1T','8935001200059','Ổ cứng SSD','Samsung',2690000,60,[['Dung lượng','1TB'],['Chuẩn kết nối','M.2 NVMe PCIe 4.0'],['Tốc độ đọc','7000 MB/s']],true,5,6),
 P(6,'Western Digital Blue 2TB','HDD-WDB-2T','8935001200066','Ổ cứng HDD','Western Digital',1490000,24,[['Dung lượng','2TB'],['Chuẩn kết nối','SATA III'],['Tốc độ quay','5400 vòng/phút']],true,4,0),
 P(7,'MSI GeForce RTX 4060 Ventus 2X 8GB','VGA-4060-V2X','8935001200073','Card đồ họa (VGA)','MSI',8990000,36,[['Bộ nhớ','8GB GDDR6'],['Chuẩn kết nối','PCIe 4.0 x8'],['Nguồn khuyến nghị','550W']],true,3,4),
 P(8,'Corsair RM750e 750W 80 Plus Gold','PSU-RM750E','8935001200080','Nguồn máy tính','Corsair',2590000,84,[['Công suất','750W'],['Chuẩn hiệu suất','80 Plus Gold'],['Kiểu dây','Full modular']],true,4,9),
 P(9,'Deepcool AK400 tản nhiệt khí','FAN-AK400','8935001200097','Tản nhiệt','Deepcool',450000,12,[['Loại tản','Tản khí 1 tháp'],['Socket hỗ trợ','LGA1700, AM5, AM4'],['Chiều cao','155 mm']],false,10,22),
 P(10,'NZXT H5 Flow','CASE-H5FLOW','8935001200103','Vỏ case','NZXT',1890000,12,[['Kích thước','Mid Tower'],['Hỗ trợ mainboard','ATX, Micro-ATX, Mini-ITX'],['Số quạt kèm theo','2 quạt 120mm']],false,3,7),
 P(11,'LG UltraGear 24GN600 24 inch 144Hz','LCD-LG24GN600','8935001200110','Màn hình','LG',3490000,24,[['Kích thước','24 inch'],['Độ phân giải','Full HD 1920x1080'],['Tần số quét','144 Hz']],true,3,5),
 P(12,'Chuột Logitech G102','ACC-LG-G102','8935001200127','Chuột','Logitech',390000,12,[['Chuẩn kết nối','USB có dây'],['Chiều dài','1.8 m']],true,10,30,'Tạm ngừng bán'),
 P(13,'Intel Core i7-12700K','CPU-I712700K','8935001200134','CPU','Intel',7290000,36,[['Socket','LGA1700'],['Số nhân / luồng','12 nhân / 20 luồng']],true,0,2,'Ngừng kinh doanh'),
 P(14,'Cáp SATA 3 dài 50cm','ACC-SATA-50','8935001200141','Cáp - Dây nối','Ugreen',35000,3,[['Chuẩn kết nối','SATA III'],['Chiều dài','50 cm']],false,20,0,'Đang kinh doanh',false)
];
var nextId=100;
/* Đổi sản phẩm mẫu từ "tên loại" sang "id loại" để sau này đổi tên loại không làm hỏng liên kết. */
products.forEach(function(p){p.cat=CATS.filter(function(c){return c.name===p.type})[0].id;delete p.type});

/* Nhà cung cấp và khách hàng mẫu, dùng để tạo dữ liệu Serial giả. */
var suppliers=['Nhà phân phối Việt Tiến','Công ty Thành Đạt','Nhà phân phối Minh Long'];
var customers=['Nguyễn Văn An','Trần Thị Bích','Lê Hoàng Nam','Phạm Quốc Huy','Võ Thị Lan','Đặng Minh Tuấn'];
/* SERIAL MẪU: vòng lặp bên dưới sinh số Serial cho mọi sản phẩm có bật quản lý Serial. Số đã bán có hóa đơn, ngày bán, khách hàng; số còn trong kho thì không. Dùng cho tab Tra cứu Serial. */
var serials=[];
(function(){
  var n=0, soldAgo=[15,120,400];
  products.forEach(function(p){
    if(!p.serial) return;
    var prefix=p.brand.replace(/[^A-Za-z]/g,'').slice(0,3).toUpperCase();
    var sold=p.hasData?3:0, total=p.stock+sold;
    for(var i=0;i<total;i++){
      n++;
      var isSold=i>=p.stock, sa=isSold?soldAgo[i-p.stock]:0;
      var ra=isSold?sa+20+(n%30):5+((n*11)%60);
      serials.push({sn:prefix+'-'+String(260000+n*7919).padStart(8,'0'),pid:p.id,
        receipt:'PN-'+String(1040+((n*7)%40)).padStart(4,'0'),receiptDate:daysAgo(ra).getTime(),supplier:suppliers[n%3],
        invoice:isSold?'HD-'+String(2000+n*3):null,soldDate:isSold?daysAgo(sa).getTime():null,customer:isSold?customers[n%customers.length]:null});
    }
  });
})();
/* NHẬT KÝ ĐIỀU CHỈNH TỒN KHO mẫu: thời gian, sản phẩm, tồn cũ -> mới, lý do, người làm. */
var adjustLog=[
 {t:daysAgo(3).getTime(),pid:5,from:7,to:6,reason:'Kiểm kê cuối tuần: thiếu 1 ổ, đã đối chiếu với hóa đơn',by:'Quản lý kho'},
 {t:daysAgo(9).getTime(),pid:4,from:38,to:40,reason:'Nhập sai số lượng trên phiếu nhập, đếm lại thực tế được 40',by:'Quản lý kho'}
];

/* S = trạng thái bộ lọc và tab của màn hình Sản phẩm: tab đang mở, từ khóa (q), loại (type, lưu id), hãng, tình trạng, khoảng giá (min/max). */
var S={tab:'products',q:'',type:'',brand:'',status:'',min:'',max:''};

/* TÌNH TRẠNG SẢN PHẨM: quy đổi dữ liệu thành nhãn hiển thị và các điều kiện cảnh báo. */
/* eff(p): tình trạng HIỂN THỊ. Ngừng kinh doanh / Tạm ngừng bán giữ nguyên; còn lại, tồn = 0 thì là 'Hết hàng', ngược lại 'Đang kinh doanh'. */
function eff(p){
  if(p.status==='Ngừng kinh doanh') return 'Ngừng kinh doanh';
  if(p.status==='Tạm ngừng bán') return 'Tạm ngừng bán';
  return p.stock===0?'Hết hàng':'Đang kinh doanh';
}
/* isLow(p): sản phẩm đang bán, còn hàng nhưng tồn đã chạm hoặc thấp hơn mức cảnh báo -> hiện nhãn "Sắp hết". */
function isLow(p){return p.status==='Đang kinh doanh'&&p.stock>0&&p.min>0&&p.stock<=p.min}
/* needsOrder(p): giống isLow nhưng tính cả khi hết hẳn (tồn = 0). Dùng cho khung "Cần nhập thêm hàng" và số đỏ trên tab Tồn kho. */
function needsOrder(p){return p.status==='Đang kinh doanh'&&p.min>0&&p.stock<=p.min}
/* pillFor(p): tạo nhãn màu cho tình trạng (xanh/vàng/đỏ/xám). */
function pillFor(p){
  var e=eff(p),c={'Đang kinh doanh':'ok','Tạm ngừng bán':'warn','Ngừng kinh doanh':'off','Hết hàng':'bad'}[e];
  return '<span class="pill '+c+'">'+e+'</span>';
}
/* byId(id): tìm sản phẩm theo id. */
function byId(id){return products.filter(function(p){return p.id===id})[0]}

/* LỌC VÀ VẼ DANH SÁCH SẢN PHẨM. */
/* matches(p): sản phẩm p có khớp mọi bộ lọc không. Từ khóa tách thành nhiều từ và phải khớp TẤT CẢ (tìm trong tên, SKU, mã vạch, hãng, đường dẫn loại, thông số). Lọc loại tính cả loại con (subIds). Lọc giá theo khoảng. Lọc tình trạng có thêm mục "Sắp hết hàng". */
function matches(p){
  var q=S.q.trim().toLowerCase();
  if(q){
    var hay=[p.name,p.sku,p.barcode,p.brand,catPath(p.cat)].concat(p.specs.map(function(s){return s[0]+' '+s[1]})).join(' ').toLowerCase();
    if(!q.split(/\s+/).every(function(w){return hay.indexOf(w)>-1})) return false;
  }
  if(S.type&&subIds(Number(S.type)).indexOf(p.cat)<0) return false;
  if(S.brand&&p.brand!==S.brand) return false;
  if(S.min!==''&&p.price<Number(S.min)) return false;
  if(S.max!==''&&p.price>Number(S.max)) return false;
  if(S.status){
    if(S.status==='Sắp hết hàng'){ if(!isLow(p)) return false; }
    else if(eff(p)!==S.status) return false;
  }
  return true;
}

/* renderFilters(): đổ lại các ô chọn Loại (có thụt lề theo cây), Hãng (từ danh sách thương hiệu), Tình trạng, và giữ giá trị đang chọn. */
function renderFilters(){
  var brands=bnames();
  $('ftype').innerHTML='<option value="">Tất cả loại</option>'+catOptions(Number(S.type)||null,false);
  $('fbrand').innerHTML='<option value="">Tất cả thương hiệu</option>'+brands.map(function(b){return '<option'+(S.brand===b?' selected':'')+'>'+esc(b)+'</option>'}).join('');
  var st=['Đang kinh doanh','Sắp hết hàng','Hết hàng','Tạm ngừng bán','Ngừng kinh doanh'];
  $('fstatus').innerHTML='<option value="">Tất cả tình trạng</option>'+st.map(function(t){return '<option'+(S.status===t?' selected':'')+'>'+t+'</option>'}).join('');
}
/* renderStats(): vẽ 4 ô thống kê nhanh và cập nhật số đỏ trên tab Tồn kho. */
function renderStats(){
  var all=products.length;
  var sell=products.filter(function(p){return eff(p)==='Đang kinh doanh'}).length;
  var low=products.filter(isLow).length;
  var out=products.filter(function(p){return eff(p)==='Hết hàng'}).length;
  var stopped=products.filter(function(p){return p.status==='Ngừng kinh doanh'}).length;
  var items=[['','Tất cả',all,''],['Đang kinh doanh','Đang bán',sell,''],['Sắp hết hàng','Sắp hết hàng',low,'warn'],['Hết hàng','Hết hàng',out,'bad'],['Ngừng kinh doanh','Ngừng KD',stopped,'off']];
  $('stats').innerHTML=items.map(function(i){
    return '<button class="stat '+i[3]+'" data-stat="'+esc(i[0])+'" aria-pressed="'+(S.status===i[0])+'"><b>'+i[2]+'</b><span>'+i[1]+'</span></button>';
  }).join('');
  var n=products.filter(needsOrder).length;
  var el=$('tabAlertN'); el.hidden=!n; el.textContent=n;
}

/* renderList(): vẽ bảng sản phẩm theo bộ lọc hiện tại. Mỗi dòng có data-id để các nút Sửa / Ngừng KD / Bán lại biết sản phẩm nào. Chưa có kết quả thì báo "Không tìm thấy". */
function renderList(){
  var rows=products.filter(matches);
  $('count').textContent='Hiển thị '+rows.length+' / '+products.length+' sản phẩm';
  if(!rows.length){ $('list').innerHTML='<div class="empty">Không tìm thấy sản phẩm nào. Thử bỏ bớt bộ lọc hoặc gõ từ khóa khác.</div>'; return; }
  var head='<div class="row head"><div>Sản phẩm</div><div>Loại / Hãng</div><div>Giá bán</div><div>Tồn kho</div><div>Bảo hành</div><div>Trạng thái</div><div style="min-width:130px"></div></div>';
  $('list').innerHTML=head+rows.map(function(p){
    var e=eff(p), stopped=p.status==='Ngừng kinh doanh';
    var thumb=p.img?'<img src="'+p.img+'" alt="">':esc(abbrC(p.cat));
    var spec=p.specs.slice(0,2).map(function(s){return esc(s[1])}).join(' · ');
    return '<div class="row'+(stopped?' off':'')+'" data-id="'+p.id+'">'+
      '<div class="cell cname"><div class="thumb">'+thumb+'</div><div class="nm"><b>'+esc(p.name)+(p.serial?'<span class="tag">Serial</span>':'')+'</b><span class="mono">'+esc(p.sku)+' · '+esc(p.barcode)+'</span><span class="specs">'+spec+'</span></div></div>'+
      '<div class="cell"><span class="l">Loại / Hãng</span>'+'<span title="'+esc(catPath(p.cat))+'">'+esc(cname(p))+'</span><div class="muted">'+esc(p.brand)+'</div></div>'+
      '<div class="cell price"><span class="l">Giá bán</span>'+money(p.price)+'</div>'+
      '<div class="cell"><span class="l">Tồn kho</span><span class="num"><b>'+p.stock+'</b></span>'+(isLow(p)?' <span class="pill warn" style="margin-left:4px">Sắp hết</span>':'')+'</div>'+
      '<div class="cell"><span class="l">Bảo hành</span>'+p.warranty+' tháng</div>'+
      '<div class="cell"><span class="l">Trạng thái</span>'+pillFor(p)+'</div>'+
      '<div class="cell cact"><button class="btn sm" data-act="edit">Sửa</button>'+(stopped?'<button class="btn sm" data-act="reopen">Bán lại</button>':'<button class="btn sm danger" data-act="stop">Ngừng KD</button>')+'</div>'+
    '</div>';
  }).join('');
}

/* TAB TỒN KHO. */
/* renderStock(): vẽ 3 phần: (1) khung cảnh báo cần nhập hàng, (2) bảng tồn kèm thanh mức tồn (đỏ khi hết, vàng khi chạm ngưỡng), (3) nhật ký điều chỉnh mới nhất lên trước. Sản phẩm ngừng kinh doanh mà hết hàng thì không hiện. */
function renderStock(){
  var need=products.filter(needsOrder).sort(function(a,b){return a.stock-b.stock});
  var al=$('alerts');
  if(need.length){
    al.innerHTML='<div class="alerts"><h3>Cần nhập thêm hàng: '+need.length+' sản phẩm đang chạm hoặc dưới mức tồn tối thiểu</h3><div class="chips">'+
      need.map(function(p){return '<button class="chip" data-adj="'+p.id+'">'+esc(p.name)+' · còn '+p.stock+'/'+p.min+'</button>'}).join('')+'</div></div>';
  } else al.innerHTML='<div class="alerts none"><h3>Tồn kho ổn, chưa có sản phẩm nào dưới mức tối thiểu</h3></div>';
  var head='<div class="srow head"><div>Sản phẩm</div><div>Tồn hiện tại</div><div>Mức tối thiểu</div><div>Mức tồn</div><div style="min-width:110px"></div></div>';
  var rows=products.filter(function(p){return p.status!=='Ngừng kinh doanh'||p.stock>0}).map(function(p){
    var cls=p.stock===0&&p.status==='Đang kinh doanh'?'bad':(isLow(p)?'warn':'');
    var ref=Math.max(p.min*2,p.stock,1), pct=Math.min(100,Math.round(p.stock/ref*100));
    var label=p.min>0?(p.stock===0?'Đã hết hàng':(p.stock<=p.min?'Chạm ngưỡng cảnh báo':'Còn đủ hàng')):'Chưa đặt ngưỡng cảnh báo';
    var thumb=p.img?'<img src="'+p.img+'" alt="">':esc(abbrC(p.cat));
    return '<div class="srow" data-id="'+p.id+'">'+
      '<div class="cell cname"><div class="thumb">'+thumb+'</div><div class="nm"><b>'+esc(p.name)+'</b><span class="mono">'+esc(p.sku)+'</span></div></div>'+
      '<div class="cell"><span class="l">Tồn hiện tại</span><span class="num"><b>'+p.stock+'</b></span></div>'+
      '<div class="cell"><span class="l">Mức tối thiểu</span><span class="num">'+(p.min||'–')+'</span></div>'+
      '<div class="cell barwrap"><div class="bar '+cls+'"><i style="width:'+pct+'%"></i></div><small>'+label+'</small></div>'+
      '<div class="cell cact"><button class="btn sm" data-adj="'+p.id+'">Kiểm kê / Điều chỉnh</button></div></div>';
  }).join('');
  $('stocklist').innerHTML=head+rows;
  var lg=adjustLog.slice().sort(function(a,b){return b.t-a.t});
  $('log').innerHTML=lg.length?lg.map(function(l){
    var p=byId(l.pid), d=l.to-l.from;
    return '<div class="logrow"><div class="mono muted">'+fmtTime(l.t)+'</div><div><b>'+esc(p?p.name:'(đã xóa)')+'</b><div class="muted">'+esc(l.by)+'</div></div>'+
      '<div class="diff '+(d>0?'up':'down')+'">'+l.from+' → '+l.to+' ('+(d>0?'+':'')+d+')</div><div>'+esc(l.reason)+'</div></div>';
  }).join(''):'<div class="empty">Chưa có lần điều chỉnh nào.</div>';
}

/* TAB TRA CỨU SERIAL. */
/* addMonths(ts,m): cộng m tháng vào một ngày, dùng tính ngày hết bảo hành. */
function addMonths(ts,m){var d=new Date(ts);d.setMonth(d.getMonth()+m);return d}
/* renderSamples(): tạo 3 nút Serial mẫu (đã bán, còn trong kho, hết bảo hành) để thử nhanh. */
function renderSamples(){
  var picks=[];
  var s1=serials.filter(function(s){return s.pid===1&&s.invoice})[0];
  var s2=serials.filter(function(s){return s.pid===5&&!s.invoice})[0];
  var s3=serials.filter(function(s){return s.pid===12&&s.invoice}).slice(-1)[0];
  [s1,s2,s3].forEach(function(s){if(s)picks.push(s)});
  $('snSamples').innerHTML=picks.map(function(s){return '<button class="chip mono" data-sn="'+esc(s.sn)+'">'+esc(s.sn)+'</button>'}).join('');
}
/* lookupSerial(): tra Serial người dùng nhập. Không thấy thì gợi ý các Serial gần giống. Thấy thì hiện: trạng thái (đã bán / trong kho), phiếu nhập + nhà cung cấp, hóa đơn + khách hàng, và bảo hành. Bảo hành tính từ NGÀY BÁN cộng số tháng của sản phẩm; chưa bán thì chưa kích hoạt bảo hành. */
function lookupSerial(){
  var q=$('sn').value.trim().toUpperCase(), out=$('snResult');
  if(!q){out.innerHTML='';return}
  var s=serials.filter(function(x){return x.sn.toUpperCase()===q})[0];
  if(!s){
    var near=serials.filter(function(x){return x.sn.toUpperCase().indexOf(q)>-1}).slice(0,6);
    out.innerHTML='<div class="result"><div class="notfound"><b>Không tìm thấy Serial "'+esc(q)+'"</b><span class="muted">Kiểm tra lại số Serial in trên tem sản phẩm. Chỉ sản phẩm được đánh dấu quản lý theo Serial mới có số Serial trong hệ thống.</span>'+
      (near.length?'<div class="lbl">Có phải bạn muốn tìm:</div><div class="chips">'+near.map(function(x){return '<button class="chip mono" data-sn="'+esc(x.sn)+'">'+esc(x.sn)+'</button>'}).join('')+'</div>':'')+'</div></div>';
    return;
  }
  var p=byId(s.pid), wm=p?p.warranty:0, sold=!!s.invoice, warr='';
  if(sold){
    var end=addMonths(s.soldDate,wm), left=Math.ceil((end.getTime()-NOW.getTime())/DAY), total=Math.max(1,Math.round((end.getTime()-s.soldDate)/DAY));
    var used=Math.min(100,Math.max(0,Math.round((total-left)/total*100)));
    var okw=left>0, cls=okw?(left<=60?'warn':''):'bad';
    var txt=okw?('Còn bảo hành '+left+' ngày (khoảng '+Math.floor(left/30)+' tháng '+(left%30)+' ngày)'):('Đã hết bảo hành '+Math.abs(left)+' ngày trước');
    warr='<div class="warr"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b>'+txt+'</b><span class="muted">Bảo hành '+wm+' tháng · từ '+fmtDate(s.soldDate)+' đến '+fmtDate(end)+'</span></div><div class="bar '+cls+'"><i style="width:'+used+'%"></i></div></div>';
  } else {
    warr='<div class="warr"><b>Chưa kích hoạt bảo hành</b><span class="muted">Hàng đang nằm trong kho. Thời gian bảo hành '+wm+' tháng sẽ tính từ ngày bán trên hóa đơn.</span></div>';
  }
  out.innerHTML='<div class="result"><div class="hd"><div><div class="sn">'+esc(s.sn)+'</div><div class="muted">'+esc(p?p.name:'')+'</div></div>'+
    '<span class="pill '+(sold?'off':'ok')+'" style="margin-left:auto">'+(sold?'Đã bán':'Đang trong kho')+'</span></div>'+
    '<div class="steps">'+
    '<div class="step"><h4>Nhập kho</h4><div class="big mono">'+esc(s.receipt)+'</div><dl><dt>Ngày nhập</dt><dd>'+fmtDate(s.receiptDate)+'</dd><dt>Nhà cung cấp</dt><dd>'+esc(s.supplier)+'</dd></dl></div>'+
    '<div class="step"><h4>Bán hàng</h4>'+(sold?'<div class="big mono">'+esc(s.invoice)+'</div><dl><dt>Ngày bán</dt><dd>'+fmtDate(s.soldDate)+'</dd><dt>Khách hàng</dt><dd>'+esc(s.customer)+'</dd></dl>':'<div class="big muted">Chưa bán</div><span class="muted">Chưa có hóa đơn nào gắn với số Serial này.</span>')+'</div>'+
    '</div>'+warr+'</div>';
}

/* NGĂN KÉO THÊM / SỬA SẢN PHẨM. */
/* EDIT = bản nháp sản phẩm đang sửa trong ngăn kéo: id (rỗng nếu thêm mới), ảnh, danh sách thông số, nS (số dòng thông số cố định theo loại). null nghĩa là ngăn kéo đang đóng. */
var EDIT=null;
/* openDrawer(id): mở ngăn kéo. Có id = sửa sản phẩm đó (nạp dữ liệu cũ); không có id = thêm mới với giá trị mặc định (loại id 1, bảo hành 36 tháng). Ngăn kéo gồm 4 nhóm: thông tin chung, giá và bảo hành, thông số kỹ thuật, kho và trạng thái. Giá nhập KHÔNG nhập ở đây (ghi theo phiếu nhập). Sản phẩm đã có giao dịch thì không có nút Xóa. */
function openDrawer(id){
  var p=id?byId(id):null;
  EDIT={id:id||null,img:p?p.img:'',specs:p?p.specs.map(function(s){return s.slice()}):[]};
  var d=p||{name:'',sku:'',barcode:'',cat:1,brand:'',price:'',warranty:36,serial:true,min:0,stock:0,status:'Đang kinh doanh',hasData:false,hist:[]};
  var h='<div class="scrim" id="scrim"><form class="drawer" id="pform" novalidate role="dialog" aria-modal="true" aria-labelledby="dttl">'+
   '<div class="dhead"><h3 id="dttl">'+(p?'Sửa sản phẩm':'Thêm sản phẩm mới')+'</h3><button type="button" class="btn sm" data-close>Đóng</button></div>'+
   '<div class="dbody"><div id="ferr"></div>'+
   '<fieldset><legend>Thông tin chung</legend>'+
    '<div class="field"><label for="f_name">Tên sản phẩm *</label><input class="inp" id="f_name" value="'+esc(d.name)+'" placeholder="Vd: Intel Core i5-14400F"></div>'+
    '<div class="g2"><div class="field"><label for="f_sku">Mã SKU *</label><input class="inp mono" id="f_sku" value="'+esc(d.sku)+'" placeholder="CPU-I514400F"></div>'+
    '<div class="field"><label for="f_bar">Mã vạch</label><input class="inp mono" id="f_bar" inputmode="numeric" value="'+esc(d.barcode)+'" placeholder="Quét hoặc nhập mã vạch"></div></div>'+
    '<div class="g2"><div class="field"><label for="f_type">Loại sản phẩm *</label><select id="f_type">'+catOptions(d.cat,true)+'</select></div>'+
    '<div class="field"><label for="f_brand">Thương hiệu *</label><select id="f_brand"><option value="">Chọn thương hiệu</option>'+bnames().map(function(b){return '<option'+(d.brand===b?' selected':'')+'>'+esc(b)+'</option>'}).join('')+'</select></div></div>'+
    '<div class="field"><span class="lbl">Hình ảnh</span><div class="imgbox"><div class="thumb" id="f_thumb"></div><div><input type="file" id="f_img" accept="image/*" aria-label="Chọn hình ảnh"> <button type="button" class="btn sm ghost" id="f_imgx">Bỏ ảnh</button></div></div></div>'+
   '</fieldset>'+
   '<fieldset><legend>Giá bán và bảo hành</legend>'+
    '<div class="g2"><div class="field"><label for="f_price">Giá bán niêm yết (đồng) *</label><input class="inp" id="f_price" type="number" min="0" step="1000" value="'+esc(d.price)+'"></div>'+
    '<div class="field"><label for="f_war">Bảo hành (tháng)</label><input class="inp" id="f_war" type="number" min="0" value="'+esc(d.warranty)+'"></div></div>'+
    '<div class="note">Giá nhập không nhập ở đây. Giá nhập được ghi theo từng phiếu nhập hàng và dùng để tính giá vốn.</div>'+
    (p&&p.hist.length?'<div><div class="lbl" style="margin-bottom:6px">Lịch sử đổi giá bán</div><div class="hist">'+p.hist.slice().sort(function(a,b){return b.d-a.d}).map(function(h){return '<div><span class="muted">'+fmtDate(h.d)+'</span><span class="num">'+money(h.from)+' → <b>'+money(h.to)+'</b></span></div>'}).join('')+'</div></div>':'')+
   '</fieldset>'+
   '<fieldset><legend>Thông số kỹ thuật</legend><div class="hint">Các trường bên dưới lấy theo loại sản phẩm đã chọn (định nghĩa ở mục Loại sản phẩm). Bạn vẫn có thể thêm thông số riêng cho sản phẩm này.</div><div id="specs" style="display:grid;gap:8px"></div>'+
    '<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn sm" id="specAdd">+ Thêm thông số</button></div></fieldset>'+
   '<fieldset><legend>Kho và trạng thái</legend>'+
    '<label class="check"><input type="checkbox" id="f_serial"'+(d.serial?' checked':'')+'><span><b>Quản lý theo số Serial</b><br><span class="hint">Bật cho hàng có tem Serial (CPU, VGA, SSD, màn hình...). Mỗi chiếc sẽ được theo dõi từ lúc nhập đến lúc bảo hành.</span></span></label>'+
    '<div class="g2"><div class="field"><label for="f_min">Cảnh báo khi tồn còn từ (cái)</label><input class="inp" id="f_min" type="number" min="0" value="'+esc(d.min)+'"><span class="hint">Để 0 nếu không cần cảnh báo.</span></div>'+
    '<div class="field"><label for="f_status">Trạng thái</label><select id="f_status">'+STATUSES.map(function(s){return '<option'+(d.status===s?' selected':'')+'>'+s+'</option>'}).join('')+'</select><span class="hint">"Hết hàng" tự hiện khi tồn kho bằng 0.</span></div></div>'+
    (p?'<div class="note">Tồn kho hiện tại: <b>'+p.stock+'</b>. Số này tự thay đổi khi nhập hàng hoặc bán hàng. Nếu kiểm kê bị lệch, dùng mục "Tồn kho" để điều chỉnh.</div>':'')+
   '</fieldset></div>'+
   '<div class="dfoot">'+(p?(p.hasData?'<span class="hint">Sản phẩm đã có giao dịch nên không thể xóa, chỉ có thể ngừng kinh doanh.</span>':'<button type="button" class="btn danger" id="btnDel">Xóa sản phẩm</button>'):'')+'<span class="sp"></span><button type="button" class="btn" data-close>Hủy</button><button type="submit" class="btn primary">'+(p?'Lưu thay đổi':'Thêm sản phẩm')+'</button></div>'+
   '</form></div>';
  $('drawerHost').innerHTML=h;
  document.body.style.overflow='hidden';
  syncSpecs(Number($('f_type').value)); drawThumb(); drawSpecs();
  $('f_name').focus();
}
/* closeDrawer(): đóng ngăn kéo, trả cuộn trang và bỏ bản nháp. */
function closeDrawer(){$('drawerHost').innerHTML='';document.body.style.overflow='';EDIT=null}
/* drawThumb(): vẽ ô xem trước ảnh trong ngăn kéo (không có ảnh thì hiện mã viết tắt của loại). */
function drawThumb(){
  var t=$('f_thumb'); if(!t) return;
  t.innerHTML=EDIT.img?'<img src="'+EDIT.img+'" alt="">':esc(abbrC(Number($('f_type').value)));
}
/* syncSpecs(cid): làm cho các dòng thông số trong biểu mẫu khớp với loại cid.
   Bước 1: lấy danh sách thông số của loại (allSpecs) làm các dòng cố định (EDIT.nS = số dòng cố định).
   Bước 2: giá trị đã nhập trùng tên thông số thì giữ lại, nên đổi loại không mất dữ liệu.
   Bước 3: thông số cũ không thuộc loại mới được giữ thành dòng "thêm riêng" (có nút Xóa). */
function syncSpecs(cid){
  var names=allSpecs(cid), old=EDIT.specs.filter(function(s){return s[0]||s[1]}), out=[];
  names.forEach(function(n){var f=old.filter(function(s){return s[0].toLowerCase()===n.toLowerCase()})[0];out.push([n,f?f[1]:''])});
  EDIT.nS=out.length;
  old.forEach(function(s){if(names.every(function(n){return n.toLowerCase()!==s[0].toLowerCase()}))out.push(s)});
  EDIT.specs=out;
}
/* drawSpecs(): vẽ các dòng thông số. Dòng cố định (i < EDIT.nS) khóa tên, chỉ nhập giá trị; dòng thêm riêng thì sửa tên và xóa được. */
function drawSpecs(){
  var box=$('specs');
  if(!EDIT.specs.length){box.innerHTML='<div class="hint">Loại này chưa có thông số định nghĩa sẵn. Bấm "Thêm thông số" nếu cần.</div>';return}
  box.innerHTML=EDIT.specs.map(function(s,i){
    var fixed=i<EDIT.nS;
    return '<div class="specrow"><input class="inp" id="sk'+i+'" data-sk="'+i+'" value="'+esc(s[0])+'" placeholder="Tên (vd: Socket)" aria-label="Tên thông số"'+(fixed?' readonly style="background:var(--surface2)"':'')+'><input class="inp" id="sv'+i+'" data-sv="'+i+'" value="'+esc(s[1])+'" placeholder="Giá trị (vd: LGA1700)" aria-label="Giá trị">'+(fixed?'<span></span>':'<button type="button" class="btn sm" data-sx="'+i+'" aria-label="Xóa thông số">Xóa</button>')+'</div>';
  }).join('');
}
/* resizeImage(file,cb): đọc ảnh người dùng chọn, thu nhỏ còn tối đa 360px rồi nén JPEG để nhẹ bộ nhớ, sau đó trả về qua cb. */
function resizeImage(file,cb){
  var fr=new FileReader();
  fr.onload=function(){
    var im=new Image();
    im.onload=function(){
      var m=360,r=Math.min(1,m/Math.max(im.width,im.height)),c=document.createElement('canvas');
      c.width=Math.round(im.width*r);c.height=Math.round(im.height*r);
      c.getContext('2d').drawImage(im,0,0,c.width,c.height);
      cb(c.toDataURL('image/jpeg',0.82));
    };
    im.onerror=function(){cb('')};
    im.src=fr.result;
  };
  fr.readAsDataURL(file);
}
/* saveProduct(): kiểm tra (tên, SKU/mã vạch không trùng, bắt buộc chọn thương hiệu, giá) rồi lưu. Sản phẩm lưu loại bằng id (cat) và thương hiệu bằng tên (brand). */
function saveProduct(){
  var name=$('f_name').value.trim(), sku=$('f_sku').value.trim(), brand=$('f_brand').value.trim(), price=$('f_price').value;
  var errs=[];
  if(!name) errs.push('Nhập tên sản phẩm.');
  if(!sku) errs.push('Nhập mã SKU.');
  else if(products.some(function(x){return x.sku.toLowerCase()===sku.toLowerCase()&&x.id!==EDIT.id})) errs.push('Mã SKU "'+sku+'" đã có ở sản phẩm khác. Hãy dùng mã khác.');
  var bar=$('f_bar').value.trim();
  if(bar&&products.some(function(x){return x.barcode&&x.barcode===bar&&x.id!==EDIT.id})) errs.push('Mã vạch này đã gắn với sản phẩm khác.');
  if(!brand) errs.push('Chọn thương hiệu.');
  if(price===''||Number(price)<0) errs.push('Nhập giá bán (từ 0 trở lên).');
  if(errs.length){ $('ferr').innerHTML='<div class="err">'+errs.map(esc).join('<br>')+'</div>'; $('ferr').scrollIntoView({block:'nearest'}); return }
  var specs=EDIT.specs.filter(function(s){return s[0].trim()&&s[1].trim()}).map(function(s){return [s[0].trim(),s[1].trim()]});
  var data={name:name,sku:sku,barcode:bar,cat:Number($('f_type').value),brand:brand,price:Number(price),warranty:Number($('f_war').value)||0,img:EDIT.img,specs:specs,serial:$('f_serial').checked,min:Number($('f_min').value)||0,status:$('f_status').value};
  if(EDIT.id){
    var p=byId(EDIT.id);
    if(p.price!==data.price) p.hist.push({d:Date.now(),from:p.price,to:data.price});
    Object.keys(data).forEach(function(k){p[k]=data[k]});
    toast('Đã lưu thay đổi cho '+p.name);
  } else {
    data.id=nextId++; data.stock=0; data.hasData=false; data.hist=[];
    products.unshift(data);
    toast('Đã thêm sản phẩm '+data.name);
  }
  closeDrawer(); refresh();
}

/* HỘP THOẠI XÁC NHẬN VÀ ĐIỀU CHỈNH TỒN. */
/* dialog(html): hiện hộp thoại ở giữa màn hình với nội dung html. closeDialog() đóng lại. */
function dialog(html){$('dialogHost').innerHTML='<div class="scrim center" id="dscrim"><div class="dialog" role="dialog" aria-modal="true">'+html+'</div></div>'}
function closeDialog(){$('dialogHost').innerHTML=''}
/* confirmStop(id): hỏi xác nhận ngừng kinh doanh. Lịch sử nhập/bán/bảo hành vẫn giữ, có thể bán lại sau. */
function confirmStop(id){
  var p=byId(id);
  dialog('<h3>Ngừng kinh doanh sản phẩm này?</h3><p><b>'+esc(p.name)+'</b> sẽ chuyển sang trạng thái "Ngừng kinh doanh" và không còn được bán. Lịch sử nhập, bán và bảo hành vẫn được giữ nguyên. Bạn có thể bán lại sau.</p>'+
   '<div class="acts"><button class="btn" data-dclose>Giữ nguyên</button><button class="btn danger solid" data-dstop="'+id+'">Ngừng kinh doanh</button></div>');
}
/* confirmDelete(id): hỏi xác nhận xóa hẳn. Chỉ gọi được cho sản phẩm mới tạo, chưa có dữ liệu phát sinh (hasData = false). */
function confirmDelete(id){
  var p=byId(id);
  dialog('<h3>Xóa hẳn sản phẩm này?</h3><p><b>'+esc(p.name)+'</b> mới tạo và chưa có dữ liệu phát sinh nên được phép xóa. Sau khi xóa không thể khôi phục.</p>'+
   '<div class="acts"><button class="btn" data-dclose>Không xóa</button><button class="btn danger solid" data-ddel="'+id+'">Xóa sản phẩm</button></div>');
}
/* ADJ = id sản phẩm đang được điều chỉnh tồn. REASONS = các lý do gợi ý nhanh. */
var ADJ=null;
var REASONS=['Kiểm kê thiếu hàng','Kiểm kê thừa hàng','Hàng lỗi, hỏng','Nhập sai số lượng'];
/* openAdjust(id): hộp thoại kiểm kê. Nhập số đếm thực tế, hệ thống tự tính chênh lệch và BẮT BUỘC ghi lý do. */
function openAdjust(id){
  var p=byId(id); ADJ=id;
  dialog('<h3>Điều chỉnh tồn kho</h3><div><b>'+esc(p.name)+'</b><div class="muted mono">'+esc(p.sku)+'</div></div>'+
   '<div class="diffbox"><span>Tồn trên hệ thống</span><b class="num">'+p.stock+'</b></div>'+
   '<div class="field"><label for="a_qty">Số đếm thực tế</label><input class="inp" id="a_qty" type="number" min="0" value="'+p.stock+'"></div>'+
   '<div class="diffbox" id="a_diff"><span>Chênh lệch</span><b class="num">0</b></div>'+
   '<div class="field"><label for="a_reason">Lý do điều chỉnh *</label><textarea id="a_reason" placeholder="Vd: Kiểm kê tháng 10, thiếu 1 cái so với sổ"></textarea><div class="chips" style="margin-top:6px">'+REASONS.map(function(r){return '<button type="button" class="chip" data-reason="'+esc(r)+'">'+r+'</button>'}).join('')+'</div></div>'+
   '<div id="a_err"></div>'+
   '<div class="acts"><button class="btn" data-dclose>Hủy</button><button class="btn primary" id="a_save">Lưu điều chỉnh</button></div>');
  $('a_qty').focus(); $('a_qty').select();
}
/* updAdjDiff(): cập nhật ô "Chênh lệch" (xanh khi dư, đỏ khi thiếu) mỗi lần gõ số đếm. */
function updAdjDiff(){
  var p=byId(ADJ), v=Number($('a_qty').value), d=(isNaN(v)?p.stock:v)-p.stock;
  $('a_diff').innerHTML='<span>Chênh lệch</span><b class="num diff '+(d>0?'up':d<0?'down':'')+'">'+(d>0?'+':'')+d+'</b>';
}
/* saveAdjust(): kiểm tra (số nguyên >= 0, khác tồn hiện tại, có lý do) rồi ghi vào nhật ký và đổi tồn. Sau đó sản phẩm được coi là đã có dữ liệu (hasData = true) nên không còn xóa được. */
function saveAdjust(){
  var p=byId(ADJ), v=$('a_qty').value, reason=$('a_reason').value.trim();
  if(v===''||Number(v)<0||Math.floor(Number(v))!==Number(v)){$('a_err').innerHTML='<div class="err">Nhập số lượng thực tế là số nguyên từ 0 trở lên.</div>';return}
  if(Number(v)===p.stock){$('a_err').innerHTML='<div class="err">Số đếm bằng số trên hệ thống, không cần điều chỉnh.</div>';return}
  if(!reason){$('a_err').innerHTML='<div class="err">Bắt buộc ghi lý do để sau này đối chiếu.</div>';return}
  adjustLog.push({t:Date.now(),pid:p.id,from:p.stock,to:Number(v),reason:reason,by:'Bạn (Quản lý)'});
  p.stock=Number(v); p.hasData=true;
  closeDialog(); refresh(); toast('Đã điều chỉnh tồn kho '+p.name+' về '+p.stock);
}
/* toast(msg): hiện thông báo nổi ở đáy màn hình và tự tắt sau khoảng 3 giây. */
function toast(msg){
  var h=$('toastHost'); h.innerHTML='<div class="toast" role="status">'+esc(msg)+'</div>';
  clearTimeout(toast.t); toast.t=setTimeout(function(){h.innerHTML=''},3200);
}

/* ---------- 3.2 Loại sản phẩm & thương hiệu ---------- */
/* CS = trạng thái màn hình Loại sản phẩm: sub (ngăn đang xem), sel (id loại đang chọn), q (từ khóa), brand (lọc hãng).
   CE / BE / HC = loại, thương hiệu đang sửa và loại đang định ẩn (dùng khi hộp thoại mở). */
var CS={sub:'cats',sel:1,q:'',brand:''}, CE=null, BE=null, HC=null;
/* ===== CÁC HÀM TIỆN ÍCH CỦA CÂY LOẠI =====
   Mỗi loại là 1 object: {id, code, name, parent, desc, active, specs}
   - parent = null  -> danh mục chính (cấp 1); parent = id của loại khác -> phân loại (con)
   - active = false -> loại đã ẩn (ngừng sử dụng)
   - specs = danh sách TÊN thông số riêng của loại này (chưa gồm phần thừa hưởng)
   Cả cây chỉ là một mảng phẳng CATS, các hàm dưới đây dựng quan hệ cha - con từ trường parent.
   cat(id): lấy 1 loại theo id. */
function cat(id){return CATS.filter(function(c){return c.id===id})[0]}
/* kids(id): các loại con TRỰC TIẾP của loại id. kids(null) = danh sách danh mục chính. */
function kids(id){return CATS.filter(function(c){return c.parent===id})}
/* flat(): duyệt cây theo thứ tự cha trước, con sau; dùng để vẽ cây và các ô chọn có thụt lề. */
function flat(){var o=[];(function w(p){kids(p).forEach(function(c){o.push(c);w(c.id)})})(null);return o}
/* depth(id): độ sâu của loại (0 = danh mục chính, 1 = phân loại, ...). Dùng để thụt lề. */
function depth(id){var d=0,c=cat(id);while(c&&c.parent!=null){d++;c=cat(c.parent)}return d}
/* catPath(id): đường dẫn đầy đủ, ví dụ "Ổ cứng › Ổ cứng SSD". */
function catPath(id){var a=[],c=cat(id);while(c){a.unshift(c.name);c=c.parent==null?null:cat(c.parent)}return a.join(' › ')}
/* subIds(id): id của loại đó VÀ toàn bộ loại con cháu. Dùng để đếm và lọc "gồm cả loại con". */
function subIds(id){var r=[id];kids(id).forEach(function(k){r=r.concat(subIds(k.id))});return r}
/* cnt(id,deep): đếm sản phẩm. deep=true tính cả loại con; deep=false chỉ tính trực tiếp. */
function cnt(id,deep){var ids=deep?subIds(id):[id];return products.filter(function(p){return ids.indexOf(p.cat)>-1}).length}
/* allSpecs(id): danh sách thông số ĐẦY ĐỦ của loại = thông số của loại cha (đi ngược lên gốc) + của chính nó.
   Đây là cơ chế "thừa hưởng": SSD có Dung lượng, Chuẩn kết nối (từ Ổ cứng) + Tốc độ đọc (riêng). */
function allSpecs(id){var a=[],c=cat(id);while(c){a=c.specs.concat(a);c=c.parent==null?null:cat(c.parent)}return a}
/* cname(p): tên loại của sản phẩm p. Sản phẩm chỉ lưu p.cat (id loại), tên được tra từ CATS nên đổi tên loại là tự cập nhật khắp nơi. */
function cname(p){var c=cat(p.cat);return c?c.name:'(không rõ)'}
/* abbrC(id): chữ viết tắt hiện trong ô ảnh nhỏ khi sản phẩm chưa có hình (lấy từ mã loại, tối đa 5 ký tự). */
function abbrC(id){var c=cat(id);return c?c.code.slice(0,5):'SP'}
/* bnames(): tên thương hiệu đã sắp xếp theo bảng chữ cái tiếng Việt, dùng cho các ô chọn. */
function bnames(){return BRANDS.map(function(b){return b.name}).sort(function(a,b){return a.localeCompare(b,'vi')})}
/* bcount(n): số sản phẩm đang dùng thương hiệu tên n (quyết định thương hiệu có xóa được không). */
function bcount(n){return products.filter(function(p){return p.brand===n}).length}
/* catOptions(sel,form): tạo các thẻ <option> của cây loại, thụt lề theo cấp.
   form=true (biểu mẫu sản phẩm): loại đã ẩn bị khóa, trừ loại mà sản phẩm đang dùng.
   form=false (bộ lọc): hiện tất cả, loại ẩn có ghi "(đã ẩn)". */
function catOptions(sel,form){
  return flat().map(function(c){
    var dis=form&&!c.active&&c.id!==sel;
    return '<option value="'+c.id+'"'+(c.id===sel?' selected':'')+(dis?' disabled':'')+'>'+'\u00a0\u00a0\u00a0'.repeat(depth(c.id))+esc(c.name)+(c.active?'':' (đã ẩn)')+'</option>';
  }).join('');
}
/* renderSub(): chuyển giữa hai ngăn "Loại sản phẩm" và "Thương hiệu" (biến CS.sub quyết định ngăn nào đang hiện). */
function renderSub(){
  $('catsPane').hidden=CS.sub!=='cats';$('brandsPane').hidden=CS.sub!=='brands';
  document.querySelectorAll('[data-csub]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.csub===CS.sub))});
}
/* renderCats(): vẽ ngăn Loại sản phẩm gồm 2 cột.
   Cột trái: cây loại, mỗi dòng kèm số sản phẩm (đã cộng loại con). Bấm vào dòng thì đặt CS.sel = loại đó.
   Cột phải: chi tiết loại đang chọn (mô tả, thông số, nút thao tác) + danh sách sản phẩm thuộc loại.
   Nút Xóa chỉ bật khi loại không có sản phẩm (canDel) và không có loại con. */
function renderCats(){
  var all=flat(), c=cat(CS.sel)||all[0]; CS.sel=c.id;
  var tree='<div class="tree"><div class="th"><span>Các loại sản phẩm</span><button class="btn sm" data-ca="root" data-cid="0">+ Thêm danh mục chính</button></div>'+all.map(function(x){
    return '<button class="node'+(x.id===c.id?' sel':'')+(x.active?'':' off')+'" style="padding-left:'+(12+depth(x.id)*20)+'px" data-csel="'+x.id+'"><span class="nn">'+esc(x.name)+(x.active?'':'<span class="tag">Đã ẩn</span>')+'</span><span class="num muted" title="Số sản phẩm (gồm loại con)">'+cnt(x.id,true)+'</span></button>';
  }).join('')+'</div>';
  var inh=allSpecs(c.parent), own=c.specs, direct=cnt(c.id,false), deep=cnt(c.id,true), nk=kids(c.id).length, sibs=kids(c.parent), i=sibs.indexOf(c), canDel=deep===0&&!nk, id=c.id;
  var bs={};products.forEach(function(p){if(subIds(id).indexOf(p.cat)>-1)bs[p.brand]=(bs[p.brand]||0)+1});
  if(CS.brand&&!bs[CS.brand])CS.brand='';
  var det='<div class="cdetail"><div class="card"><div><div class="crumb">'+esc(catPath(id))+'</div><h3>'+esc(c.name)+' <span class="tag mono">'+esc(c.code)+'</span> '+(c.active?'<span class="pill ok">Đang sử dụng</span>':'<span class="pill off">Đã ẩn</span>')+'</h3></div>'+
   '<div>'+(c.desc?esc(c.desc):'<span class="muted">Chưa có mô tả.</span>')+'</div>'+
   '<div><div class="lbl" style="margin-bottom:6px">Thông số kỹ thuật dùng cho biểu mẫu thêm sản phẩm</div><div class="chips">'+(inh.length+own.length?inh.map(function(s){return '<span class="tag" title="Thừa hưởng từ loại cha">'+esc(s)+' · từ loại cha</span>'}).join('')+own.map(function(s){return '<span class="chip" style="cursor:default">'+esc(s)+'</span>'}).join(''):'<span class="muted">Chưa định nghĩa thông số nào.</span>')+'</div></div>'+
   '<div class="acts"><button class="btn sm" data-ca="edit" data-cid="'+id+'">Sửa</button><button class="btn sm" data-ca="child" data-cid="'+id+'">+ Thêm phân loại</button>'+
   '<button class="btn sm" data-ca="up" data-cid="'+id+'"'+(i<1?' disabled':'')+' aria-label="Đưa lên trên">Lên</button><button class="btn sm" data-ca="down" data-cid="'+id+'"'+(i>=sibs.length-1?' disabled':'')+' aria-label="Đưa xuống dưới">Xuống</button>'+
   (c.active?'<button class="btn sm" data-ca="hide" data-cid="'+id+'">Ẩn (ngừng sử dụng)</button>':'<button class="btn sm" data-ca="show" data-cid="'+id+'">Hiện lại</button>')+
   '<button class="btn sm danger" data-ca="del" data-cid="'+id+'"'+(canDel?'':' disabled')+'>Xóa</button></div>'+
   (canDel?'':'<div class="hint">Không thể xóa: '+(deep?'còn '+deep+' sản phẩm thuộc loại này':'loại này còn loại con')+'. Hãy chuyển sản phẩm sang loại khác hoặc chỉ ẩn loại này.</div>')+'</div>'+
   '<div class="card"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center"><b>'+deep+' sản phẩm'+(nk?' <span class="muted" style="font-weight:400">('+direct+' thuộc trực tiếp loại này)</span>':'')+'</b><button class="btn sm" data-ca="open" data-cid="'+id+'">Mở trong mục Sản phẩm</button></div>'+
   '<div class="frow first"><div class="field"><label for="cq">Tìm trong loại này</label><input class="inp" id="cq" type="search" value="'+esc(CS.q)+'" placeholder="Tên, SKU hoặc thông số"></div>'+
   '<div class="field"><label for="cbrand">Thương hiệu</label><select id="cbrand"><option value="">Tất cả</option>'+Object.keys(bs).sort().map(function(b){return '<option value="'+esc(b)+'"'+(CS.brand===b?' selected':'')+'>'+esc(b)+' ('+bs[b]+')</option>'}).join('')+'</select></div></div>'+
   '<div class="list" id="cplist"></div></div></div>';
  $('catsPane').innerHTML='<div class="cgrid">'+tree+det+'</div>';
  renderCatProducts();
}
/* renderCatProducts(): chỉ vẽ lại danh sách sản phẩm trong cột phải (mục 3.2.3).
   Lấy sản phẩm của loại đang chọn + loại con, rồi lọc theo ô tìm kiếm (CS.q) và thương hiệu (CS.brand).
   Tách riêng để gõ tìm kiếm không làm mất con trỏ ở ô nhập. */
function renderCatProducts(){
  var ids=subIds(CS.sel), q=CS.q.trim().toLowerCase();
  var rows=products.filter(function(p){
    if(ids.indexOf(p.cat)<0||(CS.brand&&p.brand!==CS.brand)) return false;
    return !q||q.split(/\s+/).every(function(w){return [p.name,p.sku,p.brand].concat(p.specs.map(function(s){return s[1]})).join(' ').toLowerCase().indexOf(w)>-1});
  });
  var el=$('cplist'); if(!el) return;
  el.innerHTML=rows.length?'<div class="prow head"><div>Sản phẩm</div><div>Loại</div><div>Hãng</div><div>Giá bán</div><div>Tồn</div></div>'+rows.map(function(p){
    return '<div class="prow"><div class="nm"><b>'+esc(p.name)+'</b><span class="mono">'+esc(p.sku)+'</span></div><div>'+esc(cname(p))+'</div><div>'+esc(p.brand)+'</div><div class="price">'+money(p.price)+'</div><div class="num"><b>'+p.stock+'</b></div></div>';
  }).join(''):'<div class="empty">Chưa có sản phẩm nào khớp trong loại này.</div>';
}
/* renderBrands(): vẽ bảng thương hiệu, mỗi dòng có số sản phẩm và các loại hàng của hãng đó.
   Nút Xóa bị khóa nếu thương hiệu còn sản phẩm. */
function renderBrands(){
  var rows=bnames().map(function(n){
    var b=BRANDS.filter(function(x){return x.name===n})[0], c=bcount(n);
    var cs=Array.from(new Set(products.filter(function(p){return p.brand===n}).map(cname)));
    return '<div class="brow"><div class="nm"><b>'+esc(n)+'</b><span class="specs">'+(cs.length?esc(cs.join(', ')):'Chưa có sản phẩm')+'</span></div><div class="num">'+c+' sản phẩm</div><div class="acts">'+
      (c?'<button class="btn sm" data-ba="open" data-bid="'+b.id+'">Xem sản phẩm</button>':'')+'<button class="btn sm" data-ba="edit" data-bid="'+b.id+'">Đổi tên</button><button class="btn sm danger" data-ba="del" data-bid="'+b.id+'"'+(c?' disabled title="Thương hiệu đang gắn với sản phẩm nên không thể xóa"':'')+'>Xóa</button></div></div>';
  }).join('');
  $('brandsPane').innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap"><span class="count" style="margin:0">'+BRANDS.length+' thương hiệu. Thương hiệu đang gắn với sản phẩm thì không xóa được.</span><button class="btn primary" data-ba="add" data-bid="0">+ Thêm thương hiệu</button></div><div class="list"><div class="brow head"><div>Thương hiệu</div><div>Số sản phẩm</div><div style="min-width:200px"></div></div>'+rows+'</div>';
}
/* catForm(id,par): mở hộp thoại thêm/sửa loại.
   - id có giá trị = sửa loại đó; id rỗng = thêm mới.
   - par = id loại cha chọn sẵn (nút "+ Thêm phân loại" truyền id loại đang chọn; nút "+ Thêm danh mục chính" truyền null).
   - Ô "loại cha" không cho chọn chính nó hoặc loại con của nó (tránh vòng lặp) và chỉ cho tối đa 4 cấp (depth<=2). */
function catForm(id,par){
  var c=id?cat(id):{code:'',name:'',desc:'',parent:par==null?null:par,specs:[]}; CE={id:id||null};
  var ex=id?subIds(id):[];
  var po='<option value="">Không có (loại gốc)</option>'+flat().filter(function(x){return ex.indexOf(x.id)<0&&depth(x.id)<=2}).map(function(x){return '<option value="'+x.id+'"'+(c.parent===x.id?' selected':'')+'>'+'\u00a0\u00a0\u00a0'.repeat(depth(x.id))+esc(x.name)+'</option>'}).join('');
  dialog('<h3>'+(id?'Sửa loại sản phẩm':(par?'Thêm phân loại':'Thêm danh mục chính'))+'</h3>'+
   '<div class="g2"><div class="field"><label for="c_code">Mã loại *</label><input class="inp mono" id="c_code" value="'+esc(c.code)+'" placeholder="Vd: PSU"></div><div class="field"><label for="c_name">Tên loại *</label><input class="inp" id="c_name" value="'+esc(c.name)+'" placeholder="Vd: Nguồn máy tính"></div></div>'+
   '<div class="field"><label for="c_parent">Vị trí: thuộc loại cha</label><select id="c_parent">'+po+'</select></div>'+
   '<div class="field"><label for="c_desc">Mô tả</label><textarea id="c_desc" style="min-height:56px">'+esc(c.desc)+'</textarea></div>'+
   '<div class="field"><label for="c_specs">Thông số kỹ thuật riêng của loại (mỗi dòng một thông số)</label><textarea id="c_specs" placeholder="Socket&#10;Số nhân&#10;Số luồng">'+esc(c.specs.join('\n'))+'</textarea><span class="hint">Loại con tự thừa hưởng thông số của loại cha. Đổi tên thông số không làm đổi dữ liệu của sản phẩm đã nhập.</span></div>'+
   '<div id="c_err"></div><div class="acts" style="justify-content:flex-end"><button class="btn" data-dclose>Hủy</button><button class="btn primary" id="c_save">'+(id?'Lưu':'Thêm loại')+'</button></div>');
  $('c_code').focus();
}
/* saveCat(): kiểm tra rồi lưu loại: mã loại không trùng, tên không trùng trong cùng nhánh.
   Thông số riêng lấy từ ô văn bản, mỗi dòng một thông số, tự bỏ dòng trống và dòng trùng.
   Đổi loại cha chính là "đổi vị trí trong cây". */
function saveCat(){
  var code=$('c_code').value.trim(), name=$('c_name').value.trim(), pv=$('c_parent').value, par=pv===''?null:Number(pv), errs=[];
  if(!code) errs.push('Nhập mã loại.'); else if(CATS.some(function(x){return x.code.toLowerCase()===code.toLowerCase()&&x.id!==CE.id})) errs.push('Mã loại "'+code+'" đã được dùng.');
  if(!name) errs.push('Nhập tên loại.'); else if(CATS.some(function(x){return x.parent===par&&x.id!==CE.id&&x.name.toLowerCase()===name.toLowerCase()})) errs.push('Đã có loại cùng tên trong nhánh này.');
  if(errs.length){$('c_err').innerHTML='<div class="err">'+errs.map(esc).join('<br>')+'</div>';return}
  var specs=$('c_specs').value.split('\n').map(function(s){return s.trim()}).filter(function(s,i,a){return s&&a.indexOf(s)===i});
  var o={code:code,name:name,desc:$('c_desc').value.trim(),parent:par,specs:specs};
  if(CE.id){var c=cat(CE.id);Object.keys(o).forEach(function(k){c[k]=o[k]});toast('Đã lưu loại '+name)}
  else{o.id=nextCat++;o.active=true;CATS.push(o);CS.sel=o.id;toast('Đã thêm loại '+name)}
  closeDialog();refresh();
}
/* hideCat(id): ngừng sử dụng (ẩn) loại.
   - Loại không có sản phẩm: ẩn ngay, ẩn luôn các loại con.
   - Loại đang có sản phẩm: hiện hộp thoại cho chọn "Chuyển sản phẩm sang loại khác rồi ẩn" hoặc "Chỉ ẩn, giữ sản phẩm". */
function hideCat(id){
  var ids=subIds(id), n=products.filter(function(p){return ids.indexOf(p.cat)>-1}).length, c=cat(id); HC=id;
  if(!n){ids.forEach(function(i){cat(i).active=false});refresh();toast('Đã ẩn loại '+c.name);return}
  var opts=flat().filter(function(x){return x.active&&ids.indexOf(x.id)<0}).map(function(x){return '<option value="'+x.id+'">'+'\u00a0\u00a0\u00a0'.repeat(depth(x.id))+esc(x.name)+'</option>'}).join('');
  dialog('<h3>Ngừng sử dụng loại "'+esc(c.name)+'"?</h3><p>Loại này'+(ids.length>1?' và các loại con':'')+' đang có <b>'+n+' sản phẩm</b>. Loại bị ẩn sẽ không còn xuất hiện khi thêm sản phẩm mới. Bạn có thể chuyển sản phẩm sang loại khác trước, hoặc chỉ ẩn và giữ nguyên sản phẩm.</p>'+
   (opts?'<div class="field"><label for="h_to">Chuyển sản phẩm sang loại</label><select id="h_to">'+opts+'</select></div>':'')+
   '<div class="acts" style="justify-content:flex-end"><button class="btn" data-dclose>Hủy</button><button class="btn" id="h_keep">Chỉ ẩn, giữ sản phẩm</button>'+(opts?'<button class="btn primary" id="h_move">Chuyển rồi ẩn</button>':'')+'</div>');
}
/* doHide(move): thực hiện ẩn. move=true thì chuyển toàn bộ sản phẩm của nhánh sang loại đã chọn (p.cat = đích) trước khi ẩn. */
function doHide(move){
  var ids=subIds(HC), c=cat(HC), msg='Đã ẩn loại '+c.name;
  if(move){var to=Number($('h_to').value),k=0;products.forEach(function(p){if(ids.indexOf(p.cat)>-1){p.cat=to;k++}});msg='Đã chuyển '+k+' sản phẩm sang "'+cat(to).name+'" và ẩn loại '+c.name}
  ids.forEach(function(i){cat(i).active=false});closeDialog();refresh();toast(msg);
}
/* moveCat(id,dir): nút Lên/Xuống, đổi chỗ với loại anh em liền kề (dir=-1 lên, +1 xuống) bằng cách hoán đổi vị trí trong mảng CATS. */
function moveCat(id,dir){
  var c=cat(id), s=kids(c.parent), j=s.indexOf(c)+dir; if(j<0||j>=s.length) return;
  var a=CATS.indexOf(c), b=CATS.indexOf(s[j]), t=CATS[a]; CATS[a]=CATS[b]; CATS[b]=t; refresh();
}
/* catAct(a,id): điều phối mọi nút thao tác của loại (root, child, edit, hide, show, del, up, down, open). Nút "open" chuyển sang tab Sản phẩm với bộ lọc loại đã đặt sẵn. */
function catAct(a,id){
  var c=cat(id);
  if(a==='root') return catForm(null,null);
  if(a==='child') return catForm(null,id);
  if(a==='edit') return catForm(id);
  if(a==='hide') return hideCat(id);
  if(a==='show'){ if(c.parent!=null&&!cat(c.parent).active){toast('Hãy hiện lại loại cha "'+cat(c.parent).name+'" trước.');return} c.active=true;refresh();toast('Đã hiện lại loại '+c.name);return}
  if(a==='del') return dialog('<h3>Xóa loại "'+esc(c.name)+'"?</h3><p>Loại này không có sản phẩm và không có loại con nên được phép xóa. Không thể khôi phục sau khi xóa.</p><div class="acts" style="justify-content:flex-end"><button class="btn" data-dclose>Không xóa</button><button class="btn danger solid" data-cdel="'+id+'">Xóa loại</button></div>');
  if(a==='up'||a==='down') return moveCat(id,a==='up'?-1:1);
  if(a==='open'){S.type=String(id);S.status='';setTab('products');refresh()}
}
/* brandForm(id): hộp thoại thêm / đổi tên thương hiệu. */
function brandForm(id){
  var b=id?BRANDS.filter(function(x){return x.id===id})[0]:{name:''}; BE={id:id||null};
  dialog('<h3>'+(id?'Đổi tên thương hiệu':'Thêm thương hiệu')+'</h3><div class="field"><label for="b_name">Tên thương hiệu *</label><input class="inp" id="b_name" value="'+esc(b.name)+'" placeholder="Vd: Gigabyte"></div>'+(id?'<div class="note">Các sản phẩm đang dùng thương hiệu này sẽ được cập nhật theo tên mới.</div>':'')+'<div id="b_err"></div><div class="acts" style="justify-content:flex-end"><button class="btn" data-dclose>Hủy</button><button class="btn primary" id="b_save">Lưu</button></div>');
  $('b_name').focus();$('b_name').select();
}
/* saveBrand(): lưu thương hiệu, không cho trùng tên. Đổi tên thì cập nhật luôn p.brand của các sản phẩm đang dùng. */
function saveBrand(){
  var n=$('b_name').value.trim();
  if(!n){$('b_err').innerHTML='<div class="err">Nhập tên thương hiệu.</div>';return}
  if(BRANDS.some(function(x){return x.name.toLowerCase()===n.toLowerCase()&&x.id!==BE.id})){$('b_err').innerHTML='<div class="err">Thương hiệu này đã có trong danh sách.</div>';return}
  if(BE.id){var b=BRANDS.filter(function(x){return x.id===BE.id})[0];products.forEach(function(p){if(p.brand===b.name)p.brand=n});if(CS.brand===b.name)CS.brand=n;if(S.brand===b.name)S.brand=n;b.name=n}
  else BRANDS.push({id:nextBrand++,name:n});
  closeDialog();refresh();toast('Đã lưu thương hiệu '+n);
}
/* brandAct(a,id): điều phối nút của thương hiệu (add, edit, open, del). */
function brandAct(a,id){
  var b=BRANDS.filter(function(x){return x.id===id})[0];
  if(a==='add') return brandForm(null);
  if(a==='edit') return brandForm(id);
  if(a==='open'){S.brand=b.name;S.status='';setTab('products');refresh();return}
  if(a==='del'){ if(bcount(b.name)){toast('Thương hiệu đang gắn với sản phẩm nên không thể xóa.');return}
    dialog('<h3>Xóa thương hiệu "'+esc(b.name)+'"?</h3><p>Chưa có sản phẩm nào dùng thương hiệu này.</p><div class="acts" style="justify-content:flex-end"><button class="btn" data-dclose>Không xóa</button><button class="btn danger solid" data-bdel="'+id+'">Xóa</button></div>') }
}

/* ---------- Các module bán hàng, nhập hàng và quản trị ----------
   Dữ liệu làm việc trong bộ nhớ và được lưu localStorage sau thay đổi.
   Phiếu nháp chưa làm thay đổi tồn; chỉ xác nhận một lần mới ghi nhận giao dịch. */
var DB={
 customers:customers.map(function(n,i){return {id:i+1,code:'KH-'+(i+1),name:n,phone:'090123450'+i,email:'kh'+(i+1)+'@example.com',group:i%2?'Thành viên':'Khách lẻ',address:'TP. Hồ Chí Minh'}}),
 suppliers:suppliers.map(function(n,i){return {id:i+1,code:'NCC-'+(i+1),name:n,phone:'028123450'+i,email:'ncc'+(i+1)+'@example.com',status:'Đang hợp tác',address:'TP. Hồ Chí Minh'}}),
 employees:[{id:1,code:'NV-1',name:'Nguyễn Minh Anh',phone:'0912345678',email:'anh@example.com',position:'Quản lý',status:'Đang làm việc'}],
 accounts:[{id:1,username:'admin',employee:'1',role:'Admin hệ thống',status:'Hoạt động'},{id:2,username:'chushop',employee:'1',role:'Quản lý (chủ shop)',status:'Hoạt động'}],
 promotions:[{id:1,code:'PC10',name:'Ưu đãi linh kiện PC',percent:10,min:1000000,from:localDay(daysAgo(7)),to:localDay(new Date(NOW.getTime()+7*DAY)),status:'Kích hoạt'}],
 orders:[],imports:[],invoices:[],logs:[]
};
var nextModuleId=100, moduleEdit=null, transactionDraft=null;
function localDay(d){d=new Date(d);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
function pick(list,id){return list.find(function(x){return String(x.id)===String(id)})}
function personName(kind,id){var p=pick(DB[kind],id);return p?p.name:'Không xác định'}
function audit(message){DB.logs.unshift({date:Date.now(),message:message})}
function options(id,values,label){var el=$(id),v=el.value;el.innerHTML='<option value="">'+esc(label||'Tất cả')+'</option>'+values.map(function(x){return '<option value="'+esc(x)+'">'+esc(x)+'</option>'}).join('');el.value=v}
function badge(s){return '<span class="pill '+(/Hoàn tất|Đã nhập|Đã thanh toán|Hoạt động|Đang|Kích hoạt/.test(s)?'ok':/Hủy|hạn|Khóa|Kết thúc|Chờ/.test(s)?'off':'warn')+'">'+esc(s)+'</span>'}
function action(label,a,kind,id){return '<button type="button" class="btn sm" data-module-action="'+a+'" data-kind="'+kind+'" data-key="'+id+'">'+esc(label)+'</button>'}
function table(host,headers,rows){$(host).innerHTML=rows.length?'<div class="module-table-wrap"><table class="module-table"><thead><tr>'+headers.map(function(x){return '<th scope="col">'+esc(x)+'</th>'}).join('')+'</tr></thead><tbody>'+rows.map(function(row){return '<tr>'+row.map(function(cell){return '<td>'+cell+'</td>'}).join('')+'</tr>'}).join('')+'</tbody></table></div>':'<div class="empty">Không có dữ liệu phù hợp.</div>'}
function field(key,label,value,type,choices){var id='m_'+key;return '<div class="field"><label for="'+id+'">'+esc(label)+'</label>'+(choices?'<select id="'+id+'">'+choices.map(function(v){var val=typeof v==='object'?v.id:v,name=typeof v==='object'?v.name:v;return '<option value="'+esc(val)+'"'+(String(value)===String(val)?' selected':'')+'>'+esc(name)+'</option>'}).join('')+'</select>':'<input class="inp" id="'+id+'" type="'+(type||'text')+'" value="'+esc(value)+'"'+(type==='number'?' min="0" step="any"':'')+'>')+'</div>'}
var CONFIG={
 customers:{prefix:'cust',title:'khách hàng',fields:[['code','Mã khách hàng'],['name','Họ tên'],['phone','Số điện thoại','tel'],['email','Email','email'],['group','Nhóm',null,['Khách lẻ','Thành viên','VIP']],['address','Địa chỉ']]},
 suppliers:{prefix:'sup',title:'nhà cung cấp',fields:[['code','Mã NCC'],['name','Tên nhà cung cấp'],['phone','Số điện thoại','tel'],['email','Email','email'],['status','Trạng thái',null,['Đang hợp tác','Ngừng hợp tác']],['address','Địa chỉ']]},
 employees:{prefix:'emp',title:'nhân viên',fields:[['code','Mã nhân viên'],['name','Họ tên'],['phone','Số điện thoại','tel'],['email','Email','email'],['position','Chức vụ',null,['Quản lý','Bán hàng','Thủ kho','Kế toán']],['status','Trạng thái',null,['Đang làm việc','Đã nghỉ việc']]]},
 accounts:{prefix:'acc',title:'tài khoản',fields:[['username','Tên đăng nhập'],['employee','Nhân viên',null,[]],['role','Vai trò',null,['Admin hệ thống','Quản lý (chủ shop)','Bán hàng','Thủ kho','Kế toán']],['status','Trạng thái',null,['Hoạt động','Khóa']]]}
};
function renderDirectory(kind){
 var c=CONFIG[kind],pre=c.prefix;
 if(kind==='customers') options('custGroup',['Khách lẻ','Thành viên','VIP'],'Tất cả nhóm');
 if(kind==='suppliers') options('supStatus',['Đang hợp tác','Ngừng hợp tác']);
 if(kind==='employees'){options('empStatus',['Đang làm việc','Đã nghỉ việc']);options('empPos',['Quản lý','Bán hàng','Thủ kho','Kế toán'],'Tất cả chức vụ')}
 if(kind==='accounts'){options('accRole',['Admin hệ thống','Quản lý (chủ shop)','Bán hàng','Thủ kho','Kế toán'],'Tất cả vai trò');options('accActive',['Hoạt động','Khóa'])}
 var q=$(pre+'Q').value.trim().toLowerCase(),rows=DB[kind].filter(function(x){
  var hay=Object.keys(x).map(function(k){return x[k]}).join(' ')+(kind==='accounts'?personName('employees',x.employee):'');
  if(hay.toLowerCase().indexOf(q)<0)return false;
  if(kind==='customers')return !$('custGroup').value||x.group===$('custGroup').value;
  if(kind==='suppliers')return !$('supStatus').value||x.status===$('supStatus').value;
  if(kind==='employees')return (!$('empStatus').value||x.status===$('empStatus').value)&&(!$('empPos').value||x.position===$('empPos').value);
  return (!$('accRole').value||x.role===$('accRole').value)&&(!$('accActive').value||x.status===$('accActive').value);
 });
 $(pre+'Count').textContent='Hiển thị '+rows.length+' / '+DB[kind].length+' '+c.title;
 table(pre+'List',kind==='accounts'?['Tên đăng nhập','Nhân viên','Vai trò','Trạng thái','Thao tác']:['Mã','Tên','Liên hệ',kind==='customers'?'Nhóm':'Trạng thái / Chức vụ','Thao tác'],rows.map(function(x){
  var cells=kind==='accounts'?[esc(x.username),esc(personName('employees',x.employee)),esc(x.role),badge(x.status)]:[esc(x.code),esc(x.name),esc(x.phone)+'<br>'+esc(x.email),kind==='customers'?esc(x.group):badge(x.status)+(x.position?'<br>'+esc(x.position):'')];
  return cells.concat('<div class="acts">'+action('Sửa','edit',kind,x.id)+(kind==='accounts'?action(x.status==='Khóa'?'Mở khóa':'Khóa','accountToggle',kind,x.id)+action('Xóa','accountDelete',kind,x.id):'')+'</div>');
 }));
 if(kind==='accounts')$('actLog').innerHTML=DB.logs.length?DB.logs.slice(0,20).map(function(x){return '<div class="module-log">'+esc(fmtTime(x.date))+' · '+esc(x.message)+'</div>'}).join(''):'<div class="empty">Chưa có hoạt động trong phiên này.</div>';
}
function renderCustomers(){renderDirectory('customers')}
function renderEmployees(){renderDirectory('employees')}
function renderAccounts(){if(!adminUnlocked()){$('accList').innerHTML='';$('actLog').innerHTML='';$('accCount').textContent='';$('systemPanel').innerHTML='';return}renderDirectory('accounts');renderSystemPanel()}
function renderSuppliers(){renderDirectory('suppliers')}
function directoryForm(kind,id){
 if(kind==='accounts'&&!allowAccountWrite())return;
 var c=CONFIG[kind],record=pick(DB[kind],id)||{};
 if(kind==='accounts'&&!DB.employees.length){toast('Hãy thêm nhân viên trước.');return}
 moduleEdit={kind:kind,id:id};
 dialog('<h3>'+(id?'Sửa ':'Thêm ')+c.title+'</h3><form id="moduleForm" class="module-form">'+c.fields.map(function(f){return field(f[0],f[1],record[f[0]]||'',f[2],kind==='accounts'&&f[0]==='employee'?DB.employees:f[3])}).join('')+'<div id="moduleError" role="alert"></div><div class="acts"><button type="button" class="btn" data-dclose>Hủy</button><button class="btn primary" type="submit">Lưu</button></div></form>');
}
function saveDirectory(){
 var m=moduleEdit,c=CONFIG[m.kind],data={},errors=[];
 if(m.kind==='accounts'&&!allowAccountWrite())return;
 c.fields.forEach(function(f){data[f[0]]=$('m_'+f[0]).value.trim()});
 var unique=m.kind==='accounts'?'username':'code';
 if(!data[unique]||!(data.name||data.username))errors.push('Vui lòng nhập mã và tên.');
 if(DB[m.kind].some(function(x){return x.id!==m.id&&x[unique].toLowerCase()===data[unique].toLowerCase()}))errors.push('Mã hoặc tên đăng nhập đã tồn tại.');
 if(data.phone&&!/^[+\d][\d\s().-]{8,14}$/.test(data.phone))errors.push('Số điện thoại không hợp lệ.');
 if(m.kind==='accounts'&&lastAdminWouldBeLost(m.id,data))errors.push('Phải giữ ít nhất một tài khoản Admin hệ thống đang hoạt động.');
 if(errors.length){$('moduleError').textContent=errors.join(' ');return}
 var record=pick(DB[m.kind],m.id);
 if(record)Object.assign(record,data);else{data.id=nextModuleId++;DB[m.kind].push(data)}
 audit('Lưu '+c.title+': '+(data.name||data.username));closeDialog();refresh();toast('Đã lưu '+c.title);
}
function promoWindow(p,day){
 day=day||localDay(new Date());if(!p.annual)return {from:p.from,to:p.to};
 var y=day.slice(0,4),start=p.from.slice(5),end=p.to.slice(5),from=y+'-'+start,to=y+'-'+end;
 if(start>end){if(day.slice(5)<=end)from=(Number(y)-1)+'-'+start;else to=(Number(y)+1)+'-'+end}
 return {from:from,to:to};
}
function promoState(p,day){day=day||localDay(new Date());var w=promoWindow(p,day);return p.status==='Kết thúc'?'Kết thúc':p.status!=='Kích hoạt'?'Tạm dừng':day<w.from?'Sắp diễn ra':day>w.to?(p.annual?'Chờ kỳ tiếp theo':'Kết thúc'):'Đang diễn ra'}
function renderPromotions(){
 var ended=false;DB.promotions.forEach(function(p){if(p.status==='Kích hoạt'&&!p.annual&&p.to<localDay(new Date())){p.status='Kết thúc';ended=true;audit('Tự động kết thúc khuyến mãi '+p.code)}});if(ended&&!storageLoadFailed)saveState();
 options('promoStatus',['Đang diễn ra','Sắp diễn ra','Chờ kỳ tiếp theo','Tạm dừng','Kết thúc']);
 var q=$('promoQ').value.trim().toLowerCase(),rows=DB.promotions.filter(function(p){return (p.code+' '+p.name).toLowerCase().includes(q)&&(!$('promoStatus').value||promoState(p)===$('promoStatus').value)});
 $('promoCount').textContent='Hiển thị '+rows.length+' / '+DB.promotions.length+' chương trình';
 table('promoList',['Mã / Chương trình','Phạm vi','Ưu đãi','Thời gian','Trạng thái','Thao tác'],rows.map(function(p){var w=promoWindow(p);return [esc(p.code)+'<br>'+esc(p.name),p.scope==='products'?(p.productIds||[]).map(function(id){var product=byId(id);return esc(product?product.name:'Sản phẩm đã xóa')}).join('<br>'):'Toàn đơn / Chương trình',esc(p.discountType==='fixed'?money(p.amount):p.percent+'%')+'<br>Đơn từ '+money(p.min)+(p.cap?'<br>Tối đa '+money(p.cap):''),fmtDate(w.from+'T00:00:00')+' – '+fmtDate(w.to+'T00:00:00')+(p.annual?'<br>Lặp hằng năm':'')+'<br>'+(p.auto===false?'Nhập mã':'Tự động'),badge(promoState(p)),'<div class="acts">'+(p.status!=='Kết thúc'?action('Sửa','edit','promotions',p.id)+action(p.status==='Kích hoạt'?'Tạm dừng':'Kích hoạt','promoToggle','promotions',p.id)+action('Kết thúc','promoEnd','promotions',p.id):'')+action('Sao chép','promoCopy','promotions',p.id)+'</div>']}));
}
function promotionForm(id,preset){
 var existing=pick(DB.promotions,id);if(existing&&existing.status==='Kết thúc'){toast('Chương trình đã kết thúc. Hãy sao chép thành đợt mới.');return}
 var p=Object.assign({code:'',name:'',percent:10,amount:0,cap:0,min:0,scope:'program',productIds:[],discountType:'percent',auto:true,annual:false,from:localDay(new Date()),to:localDay(new Date()),status:'Kích hoạt'},existing||preset||{});moduleEdit={kind:'promotions',id:id};
 dialog('<h3>'+(id?'Sửa':'Tạo')+' chương trình khuyến mãi</h3><form id="promotionForm" class="module-form"><div class="g2">'+field('code','Mã khuyến mãi',p.code)+field('name','Tên chương trình',p.name)+field('scope','Phạm vi',p.scope,null,[{id:'program',name:'Theo chương trình / Toàn đơn'},{id:'products',name:'Theo sản phẩm'}])+field('discountType','Loại ưu đãi',p.discountType,null,[{id:'percent',name:'Giảm phần trăm'},{id:'fixed',name:'Giảm số tiền'}])+field('percent','Giảm (%)',p.percent,'number')+field('amount','Số tiền giảm (đ)',p.amount,'number')+field('min','Đơn tối thiểu (đ)',p.min,'number')+field('cap','Giảm tối đa (đ, 0 = không giới hạn)',p.cap,'number')+field('from','Từ ngày',p.from,'date')+field('to','Đến ngày',p.to,'date')+field('status','Trạng thái',p.status,null,['Kích hoạt','Tạm dừng','Kết thúc'])+'</div><div class="field" id="promoProductField"><label for="m_productIds">Sản phẩm áp dụng (có thể chọn nhiều)</label><select id="m_productIds" multiple size="6">'+products.map(function(x){return '<option value="'+x.id+'"'+(p.productIds.includes(x.id)?' selected':'')+'>'+esc(x.sku+' · '+x.name)+'</option>'}).join('')+'</select></div><label class="check"><input type="checkbox" id="m_auto"'+(p.auto?' checked':'')+'>Tự động áp dụng khi đủ điều kiện</label><label class="check"><input type="checkbox" id="m_annual"'+(p.annual?' checked':'')+'>Lặp lại theo ngày/tháng hằng năm</label><p class="hint">Black Friday và các sự kiện thay đổi ngày cần tạo lịch theo từng năm. Tết âm lịch cần nhập ngày dương lịch tương ứng. Mỗi đơn dùng một ưu đãi có lợi nhất; giảm theo sản phẩm chỉ tính trên các mặt hàng được chọn.</p><div id="moduleError" role="alert"></div><div class="acts"><button type="button" class="btn" data-dclose>Hủy</button><button class="btn primary">Lưu</button></div></form>');$('dialogHost').querySelector('.dialog').classList.add('wide');syncPromoFields();
}
function syncPromoFields(){var product=$('m_scope').value==='products',fixed=$('m_discountType').value==='fixed';$('promoProductField').hidden=!product;$('m_percent').closest('.field').hidden=fixed;$('m_amount').closest('.field').hidden=!fixed}
function savePromotion(){
 var p={code:$('m_code').value.trim().toUpperCase(),name:$('m_name').value.trim(),percent:Number($('m_percent').value),amount:Number($('m_amount').value),cap:Number($('m_cap').value),min:Number($('m_min').value),scope:$('m_scope').value,productIds:Array.from($('m_productIds').selectedOptions).map(function(o){return Number(o.value)}),discountType:$('m_discountType').value,auto:$('m_auto').checked,annual:$('m_annual').checked,from:$('m_from').value,to:$('m_to').value,status:$('m_status').value};
 var error=validatePromotion(p,moduleEdit.id);if(error){$('moduleError').textContent=error;return}
 var existing=pick(DB.promotions,moduleEdit.id);if(existing)Object.assign(existing,p);else{p.id=nextModuleId++;DB.promotions.push(p)}audit('Lưu khuyến mãi '+p.code);closeDialog();refresh();toast('Đã lưu khuyến mãi');
}
/* Một giao dịch mẫu mỗi loại, ở trạng thái nháp để không làm lệch tồn mẫu. */
DB.orders.push({id:1,code:'DH-0001',party:'1',date:localDay(new Date()),status:'Nháp',items:[{pid:4,qty:1,price:790000,sns:[]}],discount:0,total:790000});
DB.imports.push({id:2,code:'PN-0001',party:'1',date:localDay(new Date()),status:'Nháp',items:[{pid:9,qty:5,price:300000,sns:[]}],discount:0,total:1500000});
function renderTransactions(kind){
 var order=kind==='orders',pre=order?'ord':'imp',partyKind=order?'customers':'suppliers';
 options(pre+'Status',order?['Nháp','Hoàn tất','Đã hủy']:['Nháp','Đã nhập','Đã hủy']);
 var q=$(pre+'Q').value.trim().toLowerCase(),rows=DB[kind].filter(function(x){return (x.code+' '+personName(partyKind,x.party)+' '+(pick(DB[partyKind],x.party)||{}).phone).toLowerCase().includes(q)&&(!$(pre+'Status').value||x.status===$(pre+'Status').value)&&(!$(pre+'From').value||x.date>=$(pre+'From').value)&&(!$(pre+'To').value||x.date<=$(pre+'To').value)});
 $(pre+'Count').textContent='Hiển thị '+rows.length+' / '+DB[kind].length+' phiếu';
 table(pre+'List',['Mã',order?'Khách hàng':'Nhà cung cấp','Ngày','Tổng tiền','Trạng thái','Thao tác'],rows.map(function(x){return [esc(x.code),esc(personName(partyKind,x.party)),fmtDate(x.date+'T00:00:00'),money(x.total),badge(x.status),'<div class="acts">'+action('Chi tiết','detail',kind,x.id)+(!order&&x.status==='Nháp'?action('Sửa phiếu','editImport',kind,x.id):'')+(x.status==='Nháp'?action(order?'Hoàn tất':'Nhập kho','confirm',kind,x.id)+action('Hủy phiếu','cancel',kind,x.id):'')+(!order?action('In 01-VT','printImport',kind,x.id):'')+'</div>']}));
 if(order)$('ordStats').innerHTML='<div class="stat"><b>'+DB.orders.length+'</b><span>Tổng đơn</span></div><div class="stat"><b>'+DB.orders.filter(function(x){return x.status==='Hoàn tất'}).length+'</b><span>Đã hoàn tất</span></div><div class="stat"><b>'+money(DB.orders.filter(function(x){return x.status==='Hoàn tất'}).reduce(function(s,x){return s+x.total},0))+'</b><span>Doanh số</span></div>';
}
function renderOrders(){renderTransactions('orders')}
function renderImports(){renderTransactions('imports')}
function lineForm(){
 return '<div class="transaction-line g2">'+field('product','Sản phẩm','',null,products.filter(function(p){return transactionDraft.kind==='imports'?p.status!=='Ngừng kinh doanh':eff(p)==='Đang kinh doanh'}).map(function(p){return {id:p.id,name:p.name+' · tồn '+p.stock}}))+field('qty',transactionDraft.kind==='imports'?'Số lượng thực nhập':'Số lượng',1,'number')+(transactionDraft.kind==='imports'?field('docQty','Số lượng theo chứng từ',1,'number')+field('unit','Đơn vị tính','Cái'):'')+field('price','Đơn giá (đ)',0,'number')+'<div class="field"><label for="m_sns">Serial (mỗi dòng một số, nếu có)</label><textarea id="m_sns" rows="2"></textarea></div></div><button type="button" class="btn" id="addTransactionLine">+ Thêm vào phiếu</button><div id="transactionLines"></div>';
}
function transactionForm(kind,id){
 var parties=kind==='orders'?DB.customers:DB.suppliers.filter(function(p){return p.status==='Đang hợp tác'});
 if(!parties.length){toast('Hãy thêm '+(kind==='orders'?'khách hàng':'nhà cung cấp')+' trước.');return}
 var existing=pick(DB[kind],id);if(existing&&existing.status!=='Nháp'){toast('Chỉ được sửa phiếu nháp.');return}
 transactionDraft={kind:kind,id:id,items:existing?JSON.parse(JSON.stringify(existing.items)):[]};
 dialog('<h3>'+(kind==='orders'?'Tạo đơn hàng':(id?'Sửa ':'Lập ')+'phiếu nhập kho · 01-VT')+'</h3><form id="transactionForm" class="module-form">'+field('party',kind==='orders'?'Khách hàng':'Nhà cung cấp',existing?existing.party:'',null,parties)+(kind==='imports'?receiptFields(existing?existing.receipt:null):'')+lineForm()+(kind==='orders'?field('promo','Mã khuyến mãi (tự động chọn nếu bỏ trống)',''):'')+'<div id="moduleError" role="alert"></div><div class="note">Lưu nháp chưa thay đổi tồn kho. '+(kind==='orders'?'Ưu đãi được tính lại theo lịch khi hoàn tất. Hoàn tất đơn sẽ trừ kho và tạo hóa đơn.':'Xác nhận nhập kho sẽ cộng số lượng thực nhập. Phiếu đã nhập được giữ nguyên để tra cứu và in.')+'</div><div class="acts"><button type="button" class="btn" data-dclose>Hủy</button><button class="btn primary">Lưu nháp</button></div></form>');
 $('dialogHost').querySelector('.dialog').classList.add('wide');syncLinePrice();renderDraftLines();
}
function syncLinePrice(){var p=byId(Number($('m_product').value));$('m_price').value=p?(transactionDraft.kind==='orders'?p.price:0):0}
function renderDraftLines(){var items=transactionDraft.items,pricing=evaluateDiscount(items,$('m_promo')?$('m_promo').value:'');$('transactionLines').innerHTML=items.length?items.map(function(x,i){var p=byId(x.pid);return '<div class="module-log">'+esc(p?p.name:x.name)+' × '+x.qty+' '+esc(x.unit||'')+' · '+money(x.price*x.qty)+(x.docQty!==undefined?' · Theo chứng từ: '+x.docQty:'')+' '+action('Bỏ','removeLine','draft',i)+'</div>'}).join('')+'<p><b>Tạm tính: '+money(pricing.subtotal)+'</b></p>'+(transactionDraft.kind==='orders'?'<p>Ưu đãi: '+esc(pricing.promo||'Không có')+' · Giảm '+money(pricing.discount)+' · Còn '+money(pricing.total)+'</p>':''):'<div class="empty">Chưa có sản phẩm trong phiếu.</div>'}
function addTransactionLine(){
 var p=byId(Number($('m_product').value)),qty=Number($('m_qty').value),price=Number($('m_price').value),sns=$('m_sns').value.split(/\r?\n/).map(function(s){return s.trim()}).filter(Boolean);
 if(!p||!Number.isSafeInteger(qty)||qty<=0||!Number.isSafeInteger(price)||price<0||$('m_price').value===''){$('moduleError').textContent='Chọn sản phẩm, số lượng nguyên dương và đơn giá nguyên không âm (đồng).';return}
 if(transactionDraft.items.some(function(x){return x.pid===p.id})){$('moduleError').textContent='Sản phẩm đã có trong phiếu. Bỏ dòng cũ để thay đổi số lượng.';return}
 if(p.serial&&transactionDraft.kind==='imports'&&(sns.length!==qty||new Set(sns).size!==sns.length||sns.some(function(sn){return serials.some(function(s){return s.sn.toLowerCase()===sn.toLowerCase()})}))){$('moduleError').textContent='Nhập đủ Serial theo số lượng, không trùng nhau hoặc trùng Serial đã có.';return}
 if(p.serial&&transactionDraft.kind==='orders'&&sns.length&&(sns.length!==qty||new Set(sns).size!==sns.length||sns.some(function(sn){return !serials.some(function(s){return s.pid===p.id&&s.sn===sn&&!s.invoice})}))){$('moduleError').textContent='Serial bán phải đủ số lượng, không trùng và đang trong kho của sản phẩm.';return}
 if(!p.serial)sns=[];
 var docQty=transactionDraft.kind==='imports'?Number($('m_docQty').value):qty,unit=$('m_unit')?$('m_unit').value.trim():'Cái';
 if(!Number.isSafeInteger(docQty)||docQty<0||!unit||($('m_docQty')&&$('m_docQty').value==='')){$('moduleError').textContent='Nhập đơn vị tính và số lượng theo chứng từ là số nguyên không âm.';return}
 if(transactionDraft.kind==='imports'&&sns.some(function(sn){return transactionDraft.items.some(function(x){return x.sns.some(function(s){return s.toLowerCase()===sn.toLowerCase()})})})){$('moduleError').textContent='Serial bị trùng giữa các dòng phiếu.';return}
 transactionDraft.items.push({pid:p.id,name:p.name,sku:p.sku,unit:unit,docQty:docQty,qty:qty,price:price,sns:sns});$('moduleError').textContent='';$('m_sns').value='';renderDraftLines();
}
function saveTransaction(){
 var d=transactionDraft;if(!d.items.length){$('moduleError').textContent='Thêm ít nhất một sản phẩm vào phiếu.';return}
 var manual=d.kind==='orders'?$('m_promo').value.trim():'',pricing=d.kind==='orders'?evaluateDiscount(d.items,manual):{subtotal:d.items.reduce(function(s,x){return s+x.qty*x.price},0),discount:0,promo:''},subtotal=pricing.subtotal;
 if(pricing.error){$('moduleError').textContent=pricing.error;return}
 var receipt=d.kind==='imports'?readReceipt():null,receiptError=receipt?validateReceipt(receipt):'';
 if(receiptError){$('moduleError').textContent=receiptError;return}
 if(!Number.isSafeInteger(Math.round(subtotal))){$('moduleError').textContent='Tổng tiền vượt giới hạn cho phép.';return}
 var id=d.id||nextModuleId++,old=pick(DB[d.kind],d.id),code=old?old.code:(d.kind==='orders'?'DH-':'PN-')+id;
 var record={id:id,code:code,party:$('m_party').value,date:receipt?receipt.date:localDay(new Date()),status:'Nháp',items:d.items,discount:pricing.discount,promo:pricing.promo,manualPromo:manual,total:subtotal-pricing.discount,receipt:receipt};
 if(old)Object.assign(old,record);else DB[d.kind].push(record);
 if(receipt)DB.settings.receiptDefaults={company:receipt.company,department:receipt.department,address:receipt.address,taxCode:receipt.taxCode,warehouse:receipt.warehouse,warehouseAddress:receipt.warehouseAddress,debit:receipt.debit,credit:receipt.credit,creator:receipt.creator,keeper:receipt.keeper,accountant:receipt.accountant};
 audit('Tạo phiếu '+code);closeDialog();refresh();toast('Đã lưu phiếu nháp');
}
function transactionDetail(kind,id){
 var x=pick(DB[kind],id),order=kind==='orders';
 if(!order){showReceipt(x);return}
 if(x.status==='Nháp'){var pricing=evaluateDiscount(x.items,x.manualPromo||'');if(!pricing.error){x.discount=pricing.discount;x.total=pricing.total;x.promo=pricing.promo}}
 dialog('<h3>'+esc(x.code)+'</h3><p>'+esc(personName(order?'customers':'suppliers',x.party))+' · '+fmtDate(x.date+'T00:00:00')+'</p><p>'+badge(x.status)+'</p>'+x.items.map(function(item){var p=byId(item.pid);return '<div class="module-log">'+esc(p?p.name:'Sản phẩm đã xóa')+' × '+item.qty+' · '+money(item.qty*item.price)+(item.sns.length?'<br><span class="mono">'+item.sns.map(esc).join(', ')+'</span>':'')+'</div>'}).join('')+'<p>Giảm giá: '+money(x.discount)+' '+esc(x.promo||'')+'</p><p><b>Tổng cộng: '+money(x.total)+'</b></p><div class="acts"><button class="btn" data-dclose>Đóng</button>'+(x.status==='Nháp'?action(order?'Hoàn tất đơn':'Xác nhận nhập kho','commit',kind,id):'')+'</div>');
}
function commitTransaction(kind,id){
 var x=pick(DB[kind],id);if(!x||x.status!=='Nháp')return;
 var order=kind==='orders',errors=[],plans=[];
 if(!order){var receiptError=validateReceipt(x.receipt);if(receiptError){toast(receiptError+' Hãy sửa phiếu trước khi nhập kho.');return}}
 var pricing=order?evaluateDiscount(x.items,x.manualPromo||''):null;
 if(pricing&&pricing.error){toast(pricing.error);return}
 x.items.forEach(function(item){
  var p=byId(item.pid),chosen=[];
  if(!p){errors.push('Sản phẩm không còn tồn tại.');return}
  if(order&&(p.status!=='Đang kinh doanh'||p.stock<item.qty)){errors.push(p.name+': không đủ tồn hoặc đã ngừng bán.');return}
  if(p.serial){
   if(order){chosen=item.sns.length?item.sns.map(function(sn){return serials.find(function(s){return s.sn===sn&&s.pid===p.id&&!s.invoice})}):serials.filter(function(s){return s.pid===p.id&&!s.invoice}).slice(0,item.qty);if(chosen.length!==item.qty||chosen.some(function(s){return !s}))errors.push(p.name+': không đủ Serial khả dụng.')}
   else if(item.sns.length!==item.qty||item.sns.some(function(sn){return serials.some(function(s){return s.sn.toLowerCase()===sn.toLowerCase()})}))errors.push(p.name+': Serial nhập đã tồn tại hoặc chưa đủ.');
  }
  plans.push({p:p,item:item,serials:chosen});
 });
 if(errors.length){toast(errors.join(' '));return}
 var invoiceCode='HD-'+x.code.slice(3),party=personName(order?'customers':'suppliers',x.party),now=Date.now();
 plans.forEach(function(plan){var p=plan.p,item=plan.item,before=p.stock;p.stock+=order?-item.qty:item.qty;p.hasData=true;
  if(p.serial){if(order){item.sns=plan.serials.map(function(s){s.invoice=invoiceCode;s.soldDate=now;s.customer=party;return s.sn})}else item.sns.forEach(function(sn){serials.push({sn:sn,pid:p.id,receipt:x.code,receiptDate:now,supplier:party,invoice:null,soldDate:null,customer:null})})}
  adjustLog.unshift({t:now,pid:p.id,from:before,to:p.stock,reason:(order?'Bán hàng ':'Nhập hàng ')+x.code,by:'Nhân viên'});
 });
 if(pricing){x.discount=pricing.discount;x.total=pricing.total;x.promo=pricing.promo}
 x.status=order?'Hoàn tất':'Đã nhập';x.confirmedAt=now;if(order)x.date=localDay(new Date());
 if(order)DB.invoices.push({id:nextModuleId++,code:invoiceCode,order:x.id,date:x.date,total:x.total,status:'Chưa thanh toán'});
 audit('Xác nhận '+x.code);closeDialog();refresh();toast(order?'Đã hoàn tất đơn và tạo hóa đơn':'Đã nhập kho');
}
function renderInvoices(){
 options('invStatus',['Chưa thanh toán','Đã thanh toán']);var q=$('invQ').value.trim().toLowerCase(),rows=DB.invoices.filter(function(x){var o=pick(DB.orders,x.order);return (x.code+' '+o.code+' '+personName('customers',o.party)).toLowerCase().includes(q)&&(!$('invStatus').value||x.status===$('invStatus').value)&&(!$('invFrom').value||x.date>=$('invFrom').value)&&(!$('invTo').value||x.date<=$('invTo').value)});
 $('invCount').textContent='Hiển thị '+rows.length+' / '+DB.invoices.length+' hóa đơn';
 table('invList',['Mã hóa đơn','Đơn hàng','Khách hàng','Ngày','Tổng tiền','Trạng thái','Thao tác'],rows.map(function(x){var o=pick(DB.orders,x.order);return [esc(x.code),esc(o.code),esc(personName('customers',o.party)),fmtDate(x.date+'T00:00:00'),money(x.total),badge(x.status),'<div class="acts">'+action('Chi tiết','detail','orders',o.id)+(x.status==='Chưa thanh toán'?action('Thanh toán','pay','invoices',x.id):'')+'</div>']}));
}
function renderReports(){
 options('rptType',['Doanh thu','Nhập hàng','Tồn kho'],'Chọn loại báo cáo');if(!$('rptType').value)$('rptType').value='Doanh thu';
 var type=$('rptType').value,from=$('rptFrom').value,to=$('rptTo').value;
 if(from&&to&&from>to){$('rptContent').innerHTML='<div class="err">Từ ngày phải trước hoặc bằng đến ngày.</div>';return}
 var rows=type==='Tồn kho'?products:DB[type==='Nhập hàng'?'imports':'orders'].filter(function(x){return x.status===(type==='Nhập hàng'?'Đã nhập':'Hoàn tất')&&(!from||x.date>=from)&&(!to||x.date<=to)});
 var value=rows.reduce(function(s,x){return s+(type==='Tồn kho'?x.stock*x.price:x.total)},0);
 $('rptContent').innerHTML=(type==='Tồn kho'?'<p class="note">Tồn kho hiện tại; giá trị tạm tính theo giá bán. Bộ lọc ngày chỉ áp dụng cho báo cáo giao dịch.</p>':'')+'<div class="rpt-cards"><div class="rpt-card"><b>'+rows.length+'</b><span>'+(type==='Tồn kho'?'Sản phẩm':'Giao dịch đã xác nhận')+'</span></div><div class="rpt-card"><b>'+money(value)+'</b><span>'+esc(type==='Tồn kho'?'Giá trị theo giá bán':type)+'</span></div></div><div class="list" id="reportTable"></div>';
 table('reportTable',type==='Tồn kho'?['SKU','Sản phẩm','Tồn','Giá bán']:['Mã','Ngày','Tổng tiền'],rows.map(function(x){return type==='Tồn kho'?[esc(x.sku),esc(x.name),String(x.stock),money(x.price)]:[esc(x.code),fmtDate(x.date+'T00:00:00'),money(x.total)]}));
}
document.addEventListener('click',function(e){
 var t=e.target.closest('button');if(!t)return;
 if(t.id==='sbToggle'){var open=$('sidebar').classList.toggle('open');t.setAttribute('aria-expanded',String(open));return}
 var adds={btnAddCust:'customers',btnAddSupplier:'suppliers',btnAddEmp:'employees',btnAddAccount:'accounts'};
 if(adds[t.id]){directoryForm(adds[t.id]);return}
 if(t.id==='btnAddPromo'){promotionForm();return}
 if(t.id==='btnAddOrder'||t.id==='btnAddImport'){transactionForm(t.id==='btnAddOrder'?'orders':'imports');return}
 if(t.id==='addTransactionLine'){addTransactionLine();return}
 if(t.id==='btnReport'){renderReports();return}
 var a=t.dataset.moduleAction,kind=t.dataset.kind,id=Number(t.dataset.key);if(!a)return;
 if(a==='edit'){if(kind==='promotions')promotionForm(id);else directoryForm(kind,id)}
 if(a==='detail'||a==='confirm')transactionDetail(kind,id);
 if(a==='commit')commitTransaction(kind,id);
 if(a==='cancel'){var x=pick(DB[kind],id);if(x&&x.status==='Nháp'){x.status='Đã hủy';audit('Hủy '+x.code);refresh();toast('Đã hủy phiếu nháp')}}
 if(a==='removeLine'){transactionDraft.items.splice(id,1);renderDraftLines()}
 if(a==='pay'){var inv=pick(DB.invoices,id);if(inv&&inv.status==='Chưa thanh toán'){inv.status='Đã thanh toán';audit('Thanh toán '+inv.code);refresh();toast('Đã ghi nhận thanh toán')}}
});
document.addEventListener('submit',function(e){
 if(e.target.id==='moduleForm'){e.preventDefault();saveDirectory()}
 if(e.target.id==='promotionForm'){e.preventDefault();savePromotion()}
 if(e.target.id==='transactionForm'){e.preventDefault();saveTransaction()}
});
function moduleFilter(e){var id=e.target.id;
 if(/^cust(Q|Group)$/.test(id))renderCustomers();
 if(/^sup(Q|Status)$/.test(id))renderSuppliers();
 if(/^emp(Q|Status|Pos)$/.test(id))renderEmployees();
 if(/^acc(Q|Role|Active)$/.test(id))renderAccounts();
 if(/^promo(Q|Status)$/.test(id))renderPromotions();
 if(/^ord(Q|Status|From|To)$/.test(id))renderOrders();
 if(/^imp(Q|Status|From|To)$/.test(id))renderImports();
 if(/^inv(Q|Status|From|To)$/.test(id))renderInvoices();
 if(/^rpt(Type|From|To)$/.test(id))renderReports();
}
document.addEventListener('input',function(e){if(e.target.type==='search')moduleFilter(e)});
document.addEventListener('change',function(e){moduleFilter(e);if(e.target.id==='m_product')syncLinePrice()});

/* ---------- Lịch ưu đãi, chứng từ 01-VT và quản trị cục bộ ---------- */
function validIsoDay(value){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value}
function validatePromotion(p,id){
 if(!p.code||!p.name||!validIsoDay(p.from)||!validIsoDay(p.to)||p.from>p.to)return 'Nhập đầy đủ mã, tên và khoảng ngày hợp lệ.';
 if(!['program','products'].includes(p.scope)||!['percent','fixed'].includes(p.discountType)||!['Kích hoạt','Tạm dừng','Kết thúc'].includes(p.status))return 'Phạm vi, loại giảm hoặc trạng thái không hợp lệ.';
 if(!Number.isSafeInteger(p.min)||p.min<0||!Number.isSafeInteger(p.cap)||p.cap<0)return 'Đơn tối thiểu và mức giảm tối đa phải là số đồng nguyên không âm.';
 if(p.discountType==='percent'&&(!Number.isFinite(p.percent)||p.percent<=0||p.percent>100))return 'Phần trăm giảm phải lớn hơn 0 và không quá 100%.';
 if(p.discountType==='fixed'&&(!Number.isSafeInteger(p.amount)||p.amount<=0))return 'Số tiền giảm phải là số đồng nguyên lớn hơn 0.';
 if(p.scope==='products'&&(!Array.isArray(p.productIds)||!p.productIds.length||p.productIds.some(function(pid){return !byId(pid)})))return 'Chọn ít nhất một sản phẩm hợp lệ.';
 if(p.annual&&(p.from.slice(5)==='02-29'||p.to.slice(5)==='02-29'))return 'Ngày 29/02 không lặp được mỗi năm; hãy tạo lịch riêng từng năm.';
 if(DB.promotions.some(function(x){return x.id!==id&&x.code.toUpperCase()===p.code.toUpperCase()}))return 'Mã khuyến mãi đã tồn tại.';
 return '';
}
function offerValue(p,items,subtotal,day){
 if(promoState(p,day)!=='Đang diễn ra'||subtotal<p.min)return 0;
 var eligible=items.reduce(function(sum,x){return sum+(p.scope!=='products'||(p.productIds||[]).includes(x.pid)?x.qty*x.price:0)},0);
 var amount=p.discountType==='fixed'?p.amount:eligible*p.percent/100;
 return Math.max(0,Math.min(eligible,Math.round(amount),p.cap>0?p.cap:Infinity));
}
function evaluateDiscount(items,manual,day){
 var subtotal=items.reduce(function(sum,x){return sum+x.qty*x.price},0),best={subtotal:subtotal,discount:0,total:subtotal,promo:''};
 manual=(manual||'').trim().toUpperCase();var explicit=manual?DB.promotions.find(function(p){return p.code.toUpperCase()===manual}):null;
 if(manual&&(!explicit||offerValue(explicit,items,subtotal,day)<=0)){best.error='Mã khuyến mãi không áp dụng: kiểm tra lịch, trạng thái, sản phẩm và giá trị đơn tối thiểu.';return best}
 DB.promotions.filter(function(p){return p.auto!==false||p===explicit}).forEach(function(p){var discount=offerValue(p,items,subtotal,day);if(discount>best.discount){best.discount=discount;best.promo=p.code}});best.total=subtotal-best.discount;return best;
}
var CAMPAIGN_TEMPLATES=[
 {id:'women',name:'Quốc tế Phụ nữ 8/3',start:'03-08',end:'03-08',percent:8,scope:'products'},
 {id:'vnwomen',name:'Phụ nữ Việt Nam 20/10',start:'10-20',end:'10-20',percent:10,scope:'products'},
 {id:'newyear',name:'Tết Dương lịch',start:'01-01',end:'01-03',percent:5},
 {id:'april',name:'30/4 – 1/5',start:'04-30',end:'05-01',percent:5},
 {id:'national',name:'Quốc khánh 2/9',start:'09-01',end:'09-02',percent:5},
 {id:'school',name:'Back to School',start:'08-01',end:'09-15',percent:7,scope:'products'},
 {id:'blackfriday',name:'Black Friday',percent:10},
 {id:'cyber',name:'Cyber Monday',percent:8},
 {id:'double11',name:'Siêu sale 11/11',start:'11-11',end:'11-11',percent:8},
 {id:'double12',name:'Siêu sale 12/12',start:'12-12',end:'12-12',percent:8},
 {id:'christmas',name:'Giáng sinh',start:'12-24',end:'12-25',percent:5},
 {id:'clearance',name:'Xả kho linh kiện cuối năm',start:'12-26',end:'12-31',percent:10,scope:'products'}
];
function campaignPreset(template,year){
 var from=year+'-'+template.start,to=year+'-'+template.end;
 if(template.id==='blackfriday'||template.id==='cyber'){var first=new Date(year,10,1),day=1+(4-first.getDay()+7)%7+21+1+(template.id==='cyber'?3:0),date=new Date(year,10,day);from=to=localDay(date)}
 var ids=products.filter(function(p){return p.status==='Đang kinh doanh'&&['RAM','SSD','ACC','MOUSE','LCD','COOL'].includes((cat(p.cat)||{}).code)}).map(function(p){return p.id});
 return {code:template.id.toUpperCase()+year,name:template.name+' '+year,from:from,to:to,percent:template.percent,amount:0,cap:500000,min:500000,scope:template.scope||'program',productIds:template.scope?ids:[],discountType:'percent',auto:true,annual:false,status:'Tạm dừng'};
}
function campaignYear(){var year=Number($('campaignYear').value);if(!Number.isInteger(year)||year<2020||year>2100){toast('Chọn năm từ 2020 đến 2100.');return null}return year}
function batchCampaigns(){var year=campaignYear();if(!year)return;var count=0;CAMPAIGN_TEMPLATES.forEach(function(t){var p=campaignPreset(t,year);if(!DB.promotions.some(function(x){return x.code===p.code})){p.id=nextModuleId++;DB.promotions.push(p);count++}});audit('Tạo '+count+' chương trình năm '+year);refresh();toast('Đã tạo '+count+' lịch ở trạng thái Tạm dừng. Duyệt và kích hoạt để áp dụng.')}
function importPromotionForm(){dialog('<h3>Nhập bộ khuyến mãi JSON</h3><p class="hint">Dùng cấu trúc từ nút Xuất dữ liệu JSON. Chỉ thêm mã mới; kiểm tra toàn bộ dữ liệu trước khi lưu. Sản phẩm tham chiếu bằng SKU để chuyển giữa các bộ dữ liệu.</p><form id="promotionImportForm" class="module-form"><label for="promotionJson">Dữ liệu JSON</label><textarea id="promotionJson" rows="12" required></textarea><div id="moduleError" role="alert"></div><div class="acts"><button type="button" class="btn" data-dclose>Hủy</button><button class="btn primary">Kiểm tra và nhập</button></div></form>');$('dialogHost').querySelector('.dialog').classList.add('wide')}
function importPromotions(){
 try{var input=JSON.parse($('promotionJson').value),list=Array.isArray(input)?input:input.promotions;if(!Array.isArray(list)||!list.length||list.length>500)throw new Error('Cần danh sách từ 1 đến 500 chương trình.');var codes=new Set();var prepared=list.map(function(raw,i){var p={code:String(raw.code||'').trim().toUpperCase(),name:String(raw.name||'').trim(),from:String(raw.from||''),to:String(raw.to||''),percent:Number(raw.percent||0),amount:Number(raw.amount||0),cap:Number(raw.cap||0),min:Number(raw.min||0),scope:raw.scope||'program',discountType:raw.discountType||'percent',status:raw.status||'Tạm dừng',auto:raw.auto!==false,annual:raw.annual===true,productIds:[]};if(p.scope==='products'){if(!Array.isArray(raw.productSkus))throw new Error('Cần productSkus cho mã '+p.code);p.productIds=raw.productSkus.map(function(sku){var product=products.find(function(x){return x.sku===sku});if(!product)throw new Error('Không tìm thấy SKU '+sku);return product.id})}var error=validatePromotion(p);if(error)throw new Error('Dòng '+(i+1)+': '+error);if(codes.has(p.code))throw new Error('Mã trùng trong dữ liệu: '+p.code);codes.add(p.code);return p});prepared.forEach(function(p){p.id=nextModuleId++;DB.promotions.push(p)});audit('Nhập '+prepared.length+' khuyến mãi');closeDialog();refresh();toast('Đã nhập '+prepared.length+' chương trình')}
 catch(error){$('moduleError').textContent=error.message}
}
function downloadJson(name,value){var blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(function(){URL.revokeObjectURL(url)},1000)}
function exportPromotions(){downloadJson('khuyen-mai-'+localDay(new Date())+'.json',{version:1,promotions:DB.promotions.map(function(p){var copy=Object.assign({},p);copy.productSkus=(p.productIds||[]).map(function(id){return (byId(id)||{}).sku}).filter(Boolean);delete copy.id;delete copy.productIds;return copy})})}

var RECEIPT_FIELDS=[['company','Tên đơn vị *'],['department','Bộ phận'],['address','Địa chỉ đơn vị *'],['taxCode','Mã số thuế'],['date','Ngày lập phiếu *','date'],['giver','Họ tên người giao hàng *'],['docType','Loại chứng từ gốc'],['docNo','Số chứng từ gốc *'],['docDate','Ngày chứng từ *','date'],['docBy','Đơn vị phát hành chứng từ *'],['warehouse','Nhập tại kho *'],['warehouseAddress','Địa điểm kho *'],['debit','Tài khoản Nợ *'],['credit','Tài khoản Có *'],['attachments','Số chứng từ gốc kèm theo','number'],['creator','Người lập phiếu *'],['keeper','Thủ kho *'],['accountant','Kế toán trưởng / Bộ phận có nhu cầu nhập *'],['reason','Lý do nhập / Ghi chú']];
function receiptFields(value){var r=Object.assign({date:localDay(new Date()),docDate:localDay(new Date()),docType:'Hóa đơn',debit:'156',credit:'331',attachments:1},DB.settings.receiptDefaults||{},value||{});return '<fieldset><legend>Thông tin phiếu nhập kho 01-VT</legend><div class="g2">'+RECEIPT_FIELDS.map(function(f){return field('receipt_'+f[0],f[1],r[f[0]]===undefined?'':r[f[0]],f[2])}).join('')+'</div></fieldset>'}
function readReceipt(){var r={};RECEIPT_FIELDS.forEach(function(f){r[f[0]]=$('m_receipt_'+f[0]).value.trim()});r.attachments=Number(r.attachments);return r}
function validateReceipt(r){if(!r)return 'Phiếu chưa có thông tin chứng từ 01-VT.';var required=RECEIPT_FIELDS.filter(function(f){return f[1].includes('*')});if(required.some(function(f){return !String(r[f[0]]||'').trim()}))return 'Điền các thông tin phiếu nhập có dấu *.';if(!validIsoDay(r.date)||!validIsoDay(r.docDate)||r.docDate>r.date)return 'Ngày chứng từ phải hợp lệ và không sau ngày lập phiếu.';if(!Number.isSafeInteger(r.attachments)||r.attachments<0)return 'Số chứng từ kèm theo phải là số nguyên không âm.';return ''}
function amountWords(value){
 var n=Math.round(value);if(!Number.isSafeInteger(n)||n<0)return '';if(!n)return 'Không đồng chẵn';var words=['không','một','hai','ba','bốn','năm','sáu','bảy','tám','chín'];
 function block(v,full){var hundred=Math.floor(v/100),ten=Math.floor(v%100/10),one=v%10,out=[];if(hundred||full){out.push(words[hundred]+' trăm')}if(ten>1){out.push(words[ten]+' mươi')}else if(ten===1)out.push('mười');else if(one&&(hundred||full))out.push('lẻ');if(one)out.push(one===1&&ten>1?'mốt':one===5&&ten>0?'lăm':words[one]);return out.join(' ')}
 var groups=[],units=['','nghìn','triệu','tỷ','nghìn tỷ','triệu tỷ'];while(n){groups.push(n%1000);n=Math.floor(n/1000)}var out=[];for(var i=groups.length-1;i>=0;i--)if(groups[i])out.push(block(groups[i],i<groups.length-1&&groups[i]<100)+' '+units[i]);var result=out.join(' ').trim().replace(/\s+/g,' ')+' đồng chẵn';return result.charAt(0).toUpperCase()+result.slice(1);
}
function receiptHtml(x){
 var r=x.receipt||{},date=(r.date||x.date).split('-'),sum=x.items.reduce(function(s,i){return s+i.qty*i.price},0);
 function text(k){return esc(r[k]||'................................')}
 return '<article class="receipt-sheet"><div class="receipt-top"><div><b>Đơn vị: '+text('company')+'</b><br>Bộ phận: '+text('department')+'<br>Địa chỉ: '+text('address')+(r.taxCode?'<br>MST: '+text('taxCode'):'')+'</div><div><b>Mẫu số 01 - VT</b><br><small>(Kèm theo Thông tư số 99/2025/TT-BTC<br>ngày 27 tháng 10 năm 2025 của Bộ trưởng Bộ Tài chính)</small></div></div><h2>PHIẾU NHẬP KHO</h2><p class="receipt-center">Ngày '+date[2]+' tháng '+date[1]+' năm '+date[0]+'<br>Số: '+esc(x.code)+(x.status!=='Đã nhập'?'<br><b>BẢN NHÁP / '+esc(x.status)+'</b>':'')+'</p><p class="receipt-account">Nợ: '+text('debit')+'<br>Có: '+text('credit')+'</p><p>- Họ và tên người giao: '+text('giver')+'<br>- Theo '+text('docType')+' số '+text('docNo')+' ngày '+(r.docDate?fmtDate(r.docDate+'T00:00:00'):'........')+' của '+text('docBy')+'<br>- Nhập tại kho: '+text('warehouse')+' · Địa điểm: '+text('warehouseAddress')+'</p><div class="receipt-scroll"><table class="receipt-lines"><thead><tr><th rowspan="2">STT</th><th rowspan="2">Tên, nhãn hiệu, quy cách, phẩm chất vật tư, dụng cụ, sản phẩm, hàng hóa</th><th rowspan="2">Mã số</th><th rowspan="2">Đơn vị tính</th><th colspan="2">Số lượng</th><th rowspan="2">Đơn giá</th><th rowspan="2">Thành tiền</th></tr><tr><th>Theo chứng từ</th><th>Thực nhập</th></tr><tr><th>A</th><th>B</th><th>C</th><th>D</th><th>1</th><th>2</th><th>3</th><th>4</th></tr></thead><tbody>'+x.items.map(function(item,i){var p=byId(item.pid)||{};return '<tr><td>'+(i+1)+'</td><td>'+esc(item.name||p.name||'')+'</td><td>'+esc(item.sku||p.sku||'')+'</td><td>'+esc(item.unit||'Cái')+'</td><td>'+(item.docQty===undefined?item.qty:item.docQty)+'</td><td>'+item.qty+'</td><td>'+esc(new Intl.NumberFormat('vi-VN').format(item.price))+'</td><td>'+esc(new Intl.NumberFormat('vi-VN').format(item.qty*item.price))+'</td></tr>'}).join('')+'<tr><th colspan="7">Cộng (đồng)</th><th>'+esc(new Intl.NumberFormat('vi-VN').format(sum))+'</th></tr></tbody></table></div><p>- Tổng số tiền (viết bằng chữ): '+esc(amountWords(sum))+'.<br>- Số chứng từ gốc kèm theo: '+(r.attachments===undefined?'....':r.attachments)+'</p>'+(r.reason?'<p>Ghi chú: '+text('reason')+'</p>':'')+'<p class="receipt-date">Ngày ..... tháng ..... năm ........</p><div class="receipt-signatures">'+[['Người lập phiếu','creator'],['Người giao hàng','giver'],['Thủ kho','keeper'],['Kế toán trưởng<br>(Hoặc bộ phận có nhu cầu nhập)','accountant']].map(function(pair){return '<div><b>'+pair[0]+'</b><br><i>(Ký, họ tên)</i><div class="signature-space"></div>'+text(pair[1])+'</div>'}).join('')+'</div></article>';
}
function showReceipt(x){dialog(receiptHtml(x)+'<div class="acts"><button class="btn" data-dclose>Đóng</button>'+action('In phiếu 01-VT','printImport','imports',x.id)+(x.status==='Nháp'?action('Sửa phiếu','editImport','imports',x.id)+action('Xác nhận nhập kho','commit','imports',x.id):'')+'</div>');$('dialogHost').querySelector('.dialog').classList.add('receipt-dialog')}
function printReceipt(id){var x=pick(DB.imports,id);if(!x)return;var old=$('receiptPrintFrame');if(old)old.remove();var frame=document.createElement('iframe');frame.id='receiptPrintFrame';frame.title='In phiếu nhập kho';frame.style.cssText='position:fixed;width:0;height:0;border:0;';document.body.appendChild(frame);frame.onload=function(){frame.contentWindow.focus();frame.contentWindow.print()};frame.srcdoc='<!doctype html><html lang="vi"><meta charset="utf-8"><title>'+esc(x.code)+'</title><style>'+RECEIPT_PRINT_CSS+'</style><body>'+receiptHtml(x)+'</body></html>'}
var RECEIPT_PRINT_CSS='@page{size:A4 landscape;margin:12mm}body{font:13px "Times New Roman",serif;color:#000}.receipt-top{display:flex;justify-content:space-between;gap:20px}.receipt-top>div{max-width:50%}h2,.receipt-center{text-align:center;margin:10px 0}.receipt-account{text-align:right}.receipt-lines{width:100%;border-collapse:collapse;font-size:12px}.receipt-lines th,.receipt-lines td{border:1px solid #000;padding:6px;overflow-wrap:anywhere}.receipt-lines th{font-weight:bold}.receipt-signatures{display:grid;grid-template-columns:repeat(4,1fr);text-align:center;gap:12px;break-inside:avoid}.signature-space{height:60px}.receipt-date{text-align:right}tr{break-inside:avoid}thead{display:table-header-group}';

var STORE_KEY='pc-shop-data-v2',ADMIN_KEY='pc-shop-admin-v1',adminUntil=0,adminAuthBusy=false;
DB.settings={maintenance:false,accountEditingLocked:false,receiptDefaults:{}};
function adminUnlocked(){return adminUntil>Date.now()}
function requireAdmin(){if(adminUnlocked())return true;adminUntil=0;renderAccounts();openAdminGate();return false}
function allowAccountWrite(){if(!requireAdmin())return false;if(DB.settings.accountEditingLocked){toast('Đang khóa sửa tài khoản. Admin cần mở khóa trong quản trị hệ thống.');return false}return true}
function lastAdminWouldBeLost(id,replacement){var old=pick(DB.accounts,id);return old&&old.role==='Admin hệ thống'&&old.status==='Hoạt động'&&(!replacement||replacement.role!=='Admin hệ thống'||replacement.status!=='Hoạt động')&&!DB.accounts.some(function(a){return a.id!==id&&a.role==='Admin hệ thống'&&a.status==='Hoạt động'})}
function readAdminCredential(){try{return JSON.parse(localStorage.getItem(ADMIN_KEY)||'null')}catch(e){return null}}
async function passwordHash(password,salt){var key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);var bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new Uint8Array(salt),iterations:210000,hash:'SHA-256'},key,256);return Array.from(new Uint8Array(bits)).map(function(x){return x.toString(16).padStart(2,'0')}).join('')}
function openAdminGate(change){
 if(change&&!adminUnlocked())return;var setup=!readAdminCredential();
 dialog('<h3>'+(setup?'Thiết lập mật khẩu Admin':change?'Đổi mật khẩu Admin':'Xác thực Admin hệ thống')+'</h3><form id="adminAuthForm" class="module-form" data-change="'+(change?'1':'0')+'"><p class="hint">'+(setup?'Admin thiết lập mật khẩu riêng ở lần đầu sử dụng. Giữ mật khẩu này cho người phụ trách hệ thống.':'Chỉ người phụ trách hệ thống nhập mật khẩu để mở tài khoản và công cụ bảo trì.')+'</p>'+(!setup?field('adminOld',change?'Mật khẩu hiện tại':'Mật khẩu Admin','','password'):'')+((setup||change)?field('adminNew','Mật khẩu mới (ít nhất 10 ký tự)','','password')+field('adminConfirm','Nhập lại mật khẩu mới','','password'):'')+'<div id="adminAuthError" role="alert"></div><div class="acts"><button class="btn" type="button" data-dclose>Hủy</button><button class="btn primary" id="adminAuthSubmit">'+(setup?'Thiết lập':change?'Đổi mật khẩu':'Mở quản trị')+'</button></div></form>');
 var input=$('m_adminOld')||$('m_adminNew');input.autocomplete=setup?'new-password':'current-password';input.focus();
}
async function unlockAdmin(){
 if(adminAuthBusy)return;adminAuthBusy=true;var form=$('adminAuthForm'),change=form.dataset.change==='1',credential=readAdminCredential(),old=$('m_adminOld')?$('m_adminOld').value:'',password=$('m_adminNew')?$('m_adminNew').value:'',confirmation=$('m_adminConfirm')?$('m_adminConfirm').value:'',error=$('adminAuthError');
 try{if(!crypto.subtle)throw new Error('Cần mở ứng dụng qua localhost hoặc HTTPS để xác thực.');if(change&&!adminUnlocked())throw new Error('Phiên admin đã hết hạn.');if(credential&&credential.blockedUntil>Date.now())throw new Error('Nhập sai nhiều lần. Vui lòng thử lại sau 30 giây.');
  if(credential){var hash=await passwordHash(old,credential.salt);if(hash!==credential.hash){credential.failures=(credential.failures||0)+1;if(credential.failures>=5){credential.blockedUntil=Date.now()+30000;credential.failures=0}localStorage.setItem(ADMIN_KEY,JSON.stringify(credential));throw new Error('Mật khẩu Admin không đúng.')}}
  if(!credential||change){if(password.length<10||password!==confirmation)throw new Error('Mật khẩu mới phải ít nhất 10 ký tự và nhập lại trùng khớp.');var salt=Array.from(crypto.getRandomValues(new Uint8Array(16)));credential={salt:salt,hash:await passwordHash(password,salt)}}
  if($('adminAuthForm')!==form)return;
  credential.failures=0;credential.blockedUntil=0;localStorage.setItem(ADMIN_KEY,JSON.stringify(credential));
  if($('adminAuthForm')!==form)return;adminUntil=Date.now()+15*60*1000;audit(change?'Đổi mật khẩu Admin':'Mở quản trị hệ thống');closeDialog();setTab('accounts');refresh();
 }catch(e){if(error.isConnected)error.textContent=e.message}finally{adminAuthBusy=false}
}
function lockAdmin(){adminUntil=0;closeDialog();if(S.tab==='accounts')setTab('products');renderAccounts();toast('Đã khóa khu vực quản trị')}
function renderSystemPanel(){
 if(!adminUnlocked())return;
 $('systemPanel').innerHTML='<div class="card system-card"><p class="note">Admin hệ thống: quản lý tài khoản, khóa sửa, bảo trì. Quản lý (chủ shop): nghiệp vụ cửa hàng. Phiên quản trị tự khóa sau 15 phút không thao tác hoặc khi rời mục này.</p><div class="acts"><button class="btn" id="btnAccountEditLock">'+(DB.settings.accountEditingLocked?'Mở khóa sửa tài khoản':'Khóa sửa tài khoản')+'</button><button class="btn" id="btnMaintenance">'+(DB.settings.maintenance?'Tắt bảo trì':'Bật bảo trì')+'</button><button class="btn" id="btnAdminPassword">Đổi mật khẩu Admin</button><button class="btn" id="btnSystemBackup">Sao lưu dữ liệu</button></div><p>Khóa sửa tài khoản: <b>'+(DB.settings.accountEditingLocked?'Đang khóa':'Đang mở')+'</b> · Bảo trì: <b>'+(DB.settings.maintenance?'Đang bật':'Đang tắt')+'</b></p><p class="hint">Khóa bảo vệ thao tác tại trình duyệt này. Hệ thống nhiều người dùng cần máy chủ xác thực và kiểm tra quyền cho từng thao tác.</p></div>';
}
function accountAction(a,id){if(!allowAccountWrite())return;var x=pick(DB.accounts,id);if(!x)return;var next=Object.assign({},x,{status:x.status==='Khóa'?'Hoạt động':'Khóa'});if(lastAdminWouldBeLost(id,a==='accountToggle'?next:null)){toast('Không thể khóa hoặc xóa Admin hoạt động cuối cùng.');return}
 if(a==='accountDelete'){dialog('<h3>Xóa tài khoản '+esc(x.username)+'?</h3><p>Nhập lại tên đăng nhập để xác nhận. Nhật ký hoạt động vẫn được giữ.</p><form id="accountDeleteForm" class="module-form" data-key="'+id+'">'+field('deleteUsername','Tên đăng nhập xác nhận','')+'<div id="moduleError" role="alert"></div><div class="acts"><button class="btn" type="button" data-dclose>Hủy</button><button class="btn danger">Xóa tài khoản</button></div></form>');return}
 x.status=next.status;audit(x.status+' tài khoản '+x.username);refresh();
}
function deleteAccount(form){if(!allowAccountWrite())return;var id=Number(form.dataset.key),x=pick(DB.accounts,id);if(!x||lastAdminWouldBeLost(id,null))return;if($('m_deleteUsername').value!==x.username){$('moduleError').textContent='Tên đăng nhập xác nhận chưa đúng.';return}DB.accounts=DB.accounts.filter(function(a){return a.id!==id});audit('Xóa tài khoản '+x.username);closeDialog();refresh()}
function saveState(){try{localStorage.setItem(STORE_KEY,JSON.stringify({version:2,DB:DB,products:products,serials:serials,adjustLog:adjustLog,CATS:CATS,BRANDS:BRANDS,nextId:nextId,nextCat:nextCat,nextBrand:nextBrand,nextModuleId:nextModuleId}));window.shopPersistence.save(JSON.parse(localStorage.getItem(STORE_KEY)));return true}catch(e){$('storageNote').textContent='Không lưu được dữ liệu trên trình duyệt (bộ nhớ đầy hoặc bị chặn). Hãy xuất sao lưu trước khi đóng trang.';return false}}
async function restoreState(){try{var saved=await window.shopPersistence.load();if(!saved)saved=JSON.parse(localStorage.getItem(STORE_KEY)||'null');if(!saved)return;if(saved.version!==2||!saved.DB||!['customers','suppliers','employees','accounts','promotions','orders','imports','invoices','logs'].every(function(k){return Array.isArray(saved.DB[k])})||!['products','serials','adjustLog','CATS','BRANDS'].every(function(k){return Array.isArray(saved[k])}))throw new Error('Dữ liệu lưu không hợp lệ');DB=saved.DB;products=saved.products;serials=saved.serials;adjustLog=saved.adjustLog;CATS=saved.CATS;BRANDS=saved.BRANDS;nextId=saved.nextId;nextCat=saved.nextCat;nextBrand=saved.nextBrand;nextModuleId=saved.nextModuleId}catch(e){$('storageNote').textContent='Không tải được dữ liệu SQL Server: '+e.message;storageLoadFailed=true}}
var storageLoadFailed=false;
async function initFeatures(){await restoreState();DB.settings=Object.assign({maintenance:false,accountEditingLocked:false,receiptDefaults:{}},DB.settings||{});DB.accounts.forEach(function(a){if(a.role==='Quản trị')a.role='Admin hệ thống'});DB.promotions.forEach(function(p){Object.assign(p,{scope:p.scope||'program',discountType:p.discountType||'percent',amount:p.amount||0,cap:p.cap||0,auto:p.auto!==false,annual:!!p.annual,productIds:p.productIds||[]})});$('campaignTemplate').innerHTML=CAMPAIGN_TEMPLATES.map(function(t){return '<option value="'+t.id+'">'+esc(t.name)+'</option>'}).join('');$('campaignYear').value=new Date().getFullYear()}
document.addEventListener('click',function(e){
 var t=e.target.closest('button');if(!t)return;
 if(t.id==='btnCampaignTemplate'){var year=campaignYear();if(year)promotionForm(null,campaignPreset(CAMPAIGN_TEMPLATES.find(function(x){return x.id===$('campaignTemplate').value}),year))}
 if(t.id==='btnCampaignBatch')batchCampaigns();
 if(t.id==='btnPromoImport')importPromotionForm();
 if(t.id==='btnPromoExport')exportPromotions();
 if(t.id==='btnAdminLock')lockAdmin();
 if(t.id==='btnAdminPassword'&&requireAdmin())openAdminGate(true);
 if(t.id==='btnAccountEditLock'&&requireAdmin()){DB.settings.accountEditingLocked=!DB.settings.accountEditingLocked;audit('Khóa sửa tài khoản: '+DB.settings.accountEditingLocked);refresh()}
 if(t.id==='btnMaintenance'&&requireAdmin()){DB.settings.maintenance=!DB.settings.maintenance;audit('Bảo trì hệ thống: '+DB.settings.maintenance);refresh()}
 if(t.id==='btnSystemBackup'&&requireAdmin())downloadJson('sao-luu-cua-hang-'+localDay(new Date())+'.json',{version:2,DB:DB,products:products,serials:serials,adjustLog:adjustLog,CATS:CATS,BRANDS:BRANDS,nextId:nextId,nextCat:nextCat,nextBrand:nextBrand,nextModuleId:nextModuleId});
 var a=t.dataset.moduleAction,id=Number(t.dataset.key);
 if(a==='editImport')transactionForm('imports',id);
 if(a==='printImport')printReceipt(id);
 if(a==='accountToggle'||a==='accountDelete')accountAction(a,id);
 if(a==='promoToggle'){var p=pick(DB.promotions,id);if(p&&p.status!=='Kết thúc'){if(p.status!=='Kích hoạt'&&!p.annual&&p.to<localDay(new Date())){toast('Lịch đã qua. Hãy sửa ngày áp dụng hoặc bật lặp hằng năm trước khi kích hoạt.');return}p.status=p.status==='Kích hoạt'?'Tạm dừng':'Kích hoạt';audit('Đổi trạng thái '+p.code+': '+p.status);refresh()}}
 if(a==='promoEnd'){var p=pick(DB.promotions,id);if(p&&p.status!=='Kết thúc')dialog('<h3>Kết thúc '+esc(p.code)+'?</h3><p>Chương trình kết thúc sẽ không tái kích hoạt. Có thể sao chép để tạo đợt mới và giữ lịch sử đợt cũ.</p><div class="acts"><button class="btn" data-dclose>Hủy</button>'+action('Kết thúc','promoEndConfirm','promotions',id)+'</div>')}
 if(a==='promoEndConfirm'){var p=pick(DB.promotions,id);if(p){p.status='Kết thúc';audit('Kết thúc '+p.code);closeDialog();refresh()}}
 if(a==='promoCopy'){var p=Object.assign({},pick(DB.promotions,id));delete p.id;p.code+='-MOI';p.name+=' (đợt mới)';p.status='Tạm dừng';promotionForm(null,p)}
});
document.addEventListener('submit',function(e){if(e.target.id==='adminAuthForm'){e.preventDefault();unlockAdmin()}if(e.target.id==='promotionImportForm'){e.preventDefault();importPromotions()}if(e.target.id==='accountDeleteForm'){e.preventDefault();deleteAccount(e.target)}});
document.addEventListener('change',function(e){if(e.target.id==='m_scope'||e.target.id==='m_discountType')syncPromoFields();if(e.target.id==='m_promo')renderDraftLines()});
document.addEventListener('input',function(e){if(adminUnlocked()&&S.tab==='accounts')adminUntil=Date.now()+15*60*1000;if(e.target.id==='m_promo')renderDraftLines()});
// Chặn thay đổi nghiệp vụ khi bảo trì, kể cả biểu mẫu đang mở từ trước.
document.addEventListener('submit',function(e){if(DB.settings.maintenance&&!['adminAuthForm','accountDeleteForm'].includes(e.target.id)&&!(e.target.id==='moduleForm'&&moduleEdit&&moduleEdit.kind==='accounts'&&adminUnlocked())){e.preventDefault();e.stopImmediatePropagation();toast('Hệ thống đang bảo trì. Chưa thể thay đổi dữ liệu.')}},true);
document.addEventListener('click',function(e){var t=e.target.closest('button');if(!t)return;if(adminUnlocked()&&S.tab==='accounts')adminUntil=Date.now()+15*60*1000;if(!DB.settings.maintenance)return;var a=t.dataset.moduleAction,readOnly=t.dataset.tab||t.dataset.csub||t.dataset.csel||t.dataset.stat||t.dataset.sn||t.id==='sbToggle'||t.id==='snGo'||t.id==='btnReport'||t.id==='fclear'||t.id==='btnPromoExport'||t.closest('[data-dclose],[data-close]')||a==='detail'||a==='printImport'||/^btn(Admin|AccountEditLock|Maintenance|SystemBackup|AddAccount)/.test(t.id)||t.closest('#view-accounts')||t.closest('#adminAuthForm')||(t.closest('#moduleForm')&&moduleEdit&&moduleEdit.kind==='accounts'&&adminUnlocked())||t.closest('#accountDeleteForm');if(!readOnly){e.preventDefault();e.stopImmediatePropagation();toast('Hệ thống đang bảo trì. Chỉ được xem dữ liệu.')}},true);
setInterval(function(){if(adminUntil&&!adminUnlocked())lockAdmin();renderPromotions()},30000);
document.addEventListener('visibilitychange',function(){if(!document.hidden){if(adminUntil&&!adminUnlocked())lockAdmin();renderPromotions()}});

/* ---------- Điều khiển chung ---------- */
/* refresh(): vẽ lại toàn bộ giao diện. Mọi thao tác thay đổi dữ liệu đều gọi hàm này cuối cùng. */
function refresh(){renderFilters();renderStats();renderList();renderStock();renderSub();renderCats();renderBrands();renderCustomers();renderEmployees();renderAccounts();renderSuppliers();renderImports();renderPromotions();renderOrders();renderInvoices();renderReports();$('maintenanceNote').hidden=!DB.settings.maintenance;if(!storageLoadFailed)saveState()}
/* setTab(t): chuyển tab chính. */
var ALL_TABS=['products','cats','stock','serial','customers','orders','invoices','imports','suppliers','promotions','employees','accounts','reports'];
function setTab(t){
  if(t==='accounts'&&!requireAdmin())return;
  if(S.tab==='accounts'&&t!=='accounts'){adminUntil=0;renderAccounts()}
  S.tab=t;
  ALL_TABS.forEach(function(k){
    var view=$('view-'+k), tab=$('tab-'+k);
    if(view) view.hidden=k!==t;
    if(tab) tab.setAttribute('aria-selected',String(k===t));
  });
  var sb=$('sidebar'); if(sb) sb.classList.remove('open');
  $('sbToggle').setAttribute('aria-expanded','false');
  if(t==='accounts')renderAccounts();
}
/* Mọi nút bấm dùng 1 bộ lắng nghe chung (event delegation): nút gắn data-ca / data-ba / data-csel / data-csub,
   hàm này tìm thuộc tính đó rồi gọi hàm xử lý tương ứng. Thêm nút mới chỉ cần gắn thuộc tính và thêm 1 dòng ở đây. */
document.addEventListener('click',function(e){
  var t=e.target;
  /* Từ đây trở xuống: mỗi nhánh kiểm tra bấm trúng nút nào (qua thuộc tính data-*) rồi return sớm.
     Chuyển tab chính. */
  var tab=t.closest('[data-tab]'); if(tab){setTab(tab.dataset.tab);return}
  /* Chuyển ngăn Loại / Thương hiệu. */
  var sb=t.closest('[data-csub]'); if(sb){CS.sub=sb.dataset.csub;renderSub();return}
  /* Nút thao tác của loại (sửa, thêm con, ẩn, xóa...). */
  var ca=t.closest('[data-ca]'); if(ca){catAct(ca.dataset.ca,Number(ca.dataset.cid));return}
  /* Bấm vào một dòng của cây loại: chọn loại đó và xóa từ khóa tìm cũ. */
  var cs=t.closest('[data-csel]'); if(cs){CS.sel=Number(cs.dataset.csel);CS.q='';CS.brand='';renderCats();return}
  /* Nút thao tác của thương hiệu. */
  var ba=t.closest('[data-ba]'); if(ba){brandAct(ba.dataset.ba,Number(ba.dataset.bid));return}
  /* Xác nhận xóa loại: bỏ khỏi CATS, chọn lại loại cha. */
  var cd=t.closest('[data-cdel]'); if(cd){var cid=Number(cd.dataset.cdel),cc=cat(cid);CATS=CATS.filter(function(x){return x.id!==cid});CS.sel=cc.parent!=null?cc.parent:0;closeDialog();refresh();toast('Đã xóa loại '+cc.name);return}
  /* Xác nhận xóa thương hiệu. */
  var bd=t.closest('[data-bdel]'); if(bd){var bid=Number(bd.dataset.bdel);BRANDS=BRANDS.filter(function(x){return x.id!==bid});closeDialog();refresh();toast('Đã xóa thương hiệu');return}
  /* Các nút trong hộp thoại loại / thương hiệu / ẩn loại. */
  if(t.id==='c_save'){saveCat();return}
  if(t.id==='b_save'){saveBrand();return}
  if(t.id==='h_keep'){doHide(false);return}
  if(t.id==='h_move'){doHide(true);return}
  /* Bấm ô thống kê: bật/tắt lọc theo tình trạng. */
  var st=t.closest('[data-stat]'); if(st){S.status=S.status===st.dataset.stat?'':st.dataset.stat;refresh();return}
  /* Nút trên dòng sản phẩm: Sửa, Ngừng KD, Bán lại. */
  var row=t.closest('.row[data-id]'), act=t.closest('[data-act]');
  if(act&&row){
    var id=Number(row.dataset.id);
    if(act.dataset.act==='edit') openDrawer(id);
    if(act.dataset.act==='stop') confirmStop(id);
    if(act.dataset.act==='reopen'){var p=byId(id);p.status='Đang kinh doanh';refresh();toast('Đã mở bán lại '+p.name)}
    return;
  }
  /* Mở hộp thoại điều chỉnh tồn kho. */
  var adj=t.closest('[data-adj]'); if(adj){openAdjust(Number(adj.dataset.adj));return}
  /* Bấm Serial mẫu / gợi ý: điền vào ô và tra cứu. */
  var sn=t.closest('[data-sn]'); if(sn){$('sn').value=sn.dataset.sn;lookupSerial();return}
  /* Bấm chip lý do: điền vào ô lý do điều chỉnh. */
  var rs=t.closest('[data-reason]'); if(rs){var ta=$('a_reason');ta.value=rs.dataset.reason;ta.focus();return}
  /* Đóng ngăn kéo (nút Đóng / Hủy hoặc bấm nền mờ). */
  if(t.closest('[data-close]')||t.id==='scrim'){closeDrawer();return}
  /* Đóng hộp thoại (nút Hủy hoặc bấm nền mờ). */
  if(t.closest('[data-dclose]')||t.id==='dscrim'){closeDialog();return}
  /* Xác nhận ngừng kinh doanh. */
  var ds=t.closest('[data-dstop]'); if(ds){var p2=byId(Number(ds.dataset.dstop));p2.status='Ngừng kinh doanh';closeDialog();refresh();toast('Đã ngừng kinh doanh '+p2.name);return}
  /* Xác nhận xóa sản phẩm. */
  var dd=t.closest('[data-ddel]'); if(dd){var id3=Number(dd.dataset.ddel),pp=byId(id3);products=products.filter(function(x){return x.id!==id3});closeDialog();closeDrawer();refresh();toast('Đã xóa sản phẩm '+pp.name);return}
  /* Nút + Thêm sản phẩm; nút Xóa sản phẩm trong ngăn kéo; nút Xóa bộ lọc. */
  if(t.id==='btnAdd'){openDrawer();return}
  if(t.id==='btnDel'){confirmDelete(EDIT.id);return}
  if(t.id==='fclear'){S={tab:S.tab,q:'',type:'',brand:'',status:'',min:'',max:''};$('fq').value='';$('fmin').value='';$('fmax').value='';refresh();return}
  if(t.id==='snGo'){lookupSerial();return}
  if(t.id==='a_save'){saveAdjust();return}
  /* Thêm dòng thông số riêng; bỏ ảnh; xóa dòng thông số riêng. */
  if(t.id==='specAdd'){EDIT.specs.push(['','']);drawSpecs();var k=$('sk'+(EDIT.specs.length-1));if(k)k.focus();return}
  if(t.id==='f_imgx'){EDIT.img='';$('f_img').value='';drawThumb();return}
  var sx=t.closest('[data-sx]'); if(sx){EDIT.specs.splice(Number(sx.dataset.sx),1);drawSpecs();return}
});
/* LẮNG NGHE NHẬP LIỆU: gõ ô tìm kiếm / giá thì lọc lại ngay (không cần bấm nút); sửa thông số trong ngăn kéo thì cập nhật vào bản nháp EDIT.specs. */
document.addEventListener('input',function(e){
  var t=e.target;
  if(t.id==='fq'){S.q=t.value;renderList();return}
  if(t.id==='cq'){CS.q=t.value;renderCatProducts();return}
  if(t.id==='fmin'){S.min=t.value;renderList();return}
  if(t.id==='fmax'){S.max=t.value;renderList();return}
  if(t.id==='a_qty'){updAdjDiff();return}
  if(t.dataset&&t.dataset.sk!==undefined){EDIT.specs[Number(t.dataset.sk)][0]=t.value;return}
  if(t.dataset&&t.dataset.sv!==undefined){EDIT.specs[Number(t.dataset.sv)][1]=t.value;return}
});
/* LẮNG NGHE THAY ĐỔI Ô CHỌN: đổi bộ lọc loại/hãng/tình trạng; đổi loại sản phẩm trong ngăn kéo thì tự đổi bộ thông số (syncSpecs); chọn ảnh thì thu nhỏ rồi xem trước. */
document.addEventListener('change',function(e){
  var t=e.target;
  if(t.id==='ftype'){S.type=t.value;renderList();return}
  if(t.id==='cbrand'){CS.brand=t.value;renderCatProducts();return}
  if(t.id==='fbrand'){S.brand=t.value;renderList();return}
  if(t.id==='fstatus'){S.status=t.value;renderStats();renderList();return}
  if(t.id==='f_type'){syncSpecs(Number(t.value));drawSpecs();drawThumb();return}
  if(t.id==='f_img'&&t.files[0]){resizeImage(t.files[0],function(u){EDIT.img=u;drawThumb()});return}
});
/* Bấm nút Lưu của biểu mẫu sản phẩm: chặn tải lại trang và gọi saveProduct(). */
document.addEventListener('submit',function(e){
  if(e.target.id==='pform'){e.preventDefault();saveProduct()}
});
/* PHÍM TẮT: Esc đóng hộp thoại (hoặc ngăn kéo nếu không có hộp thoại); Enter trong ô Serial thì tra cứu, trong ô tên thương hiệu thì lưu. */
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'){ if($('dialogHost').firstChild) closeDialog(); else if(EDIT) closeDrawer(); }
  if(e.key==='Enter'&&e.target.id==='b_name'){e.preventDefault();saveBrand()}
  if(e.key==='Enter'&&e.target.id==='sn'){e.preventDefault();lookupSerial()}
});

/* KHỞI ĐỘNG: vẽ các nút Serial mẫu rồi vẽ toàn bộ giao diện lần đầu. */
await initFeatures();
renderSamples();
refresh();
})();
