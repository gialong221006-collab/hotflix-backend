const sql = require('mssql/msnodesqlv8');
const cron = require('node-cron'); // Bổ sung bộ đếm giờ

const sqlConfig = {
    connectionString: 'Driver={SQL Server};Server=.\\SQLEXPRESS;Database=HotflixDB;Trusted_Connection=yes;'
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchNewMovies() {
    try {
        console.log("\n🕵️ Bắt đầu tuần tra danh sách phim mới từ PhimAPI...");
        let pool = await sql.connect(sqlConfig);

        let response = await fetch('https://phimapi.com/danh-sach/phim-moi-cap-nhat?page=1');
        let data = await response.json();
        let items = data.items || [];

        console.log(`📡 Phát hiện ${items.length} phim vừa cập nhật. Đang đối chiếu...`);
        let addedCount = 0;

        for (let i = 0; i < items.length; i++) {
            let movieInfo = items[i];
            let slug = movieInfo.slug;

            let checkResult = await pool.request()
                .input('slug', sql.VarChar, slug)
                .query("SELECT id FROM Movies WHERE slug = @slug");

            if (checkResult.recordset.length > 0) {
                // Đã có thì âm thầm bỏ qua, không in ra để tránh rác màn hình
                continue; 
            }

            console.log(`⭐ PHIM MỚI: [${movieInfo.name}]. Đang lấy chi tiết...`);
            
            try {
                let detailRes = await fetch(`https://phimapi.com/phim/${slug}`);
                let detailData = await detailRes.json();

                if (detailData.status && detailData.movie) {
                    let detail = detailData.movie;
                    let type = detail.type || null;
                    let genres = detail.category ? detail.category.map(c => c.name).join(', ') : null;
                    let countries = detail.country ? detail.country.map(c => c.name).join(', ') : null;

                    let insertReq = pool.request();
                    insertReq.input('name', sql.NVarChar, detail.name);
                    insertReq.input('origin_name', sql.NVarChar, detail.origin_name);
                    insertReq.input('slug', sql.VarChar, slug);
                    insertReq.input('thumb_url', sql.VarChar, detail.thumb_url);
                    insertReq.input('year', sql.Int, detail.year);
                    insertReq.input('type', sql.NVarChar, type);
                    insertReq.input('genre', sql.NVarChar, genres);
                    insertReq.input('country', sql.NVarChar, countries);

                    await insertReq.query(`
                        INSERT INTO Movies (name, origin_name, slug, thumb_url, year, type, genre, country)
                        VALUES (@name, @origin_name, @slug, @thumb_url, @year, @type, @genre, @country)
                    `);
                    
                    console.log(`   ✅ Đã lên kệ thành công!`);
                    addedCount++;
                }
            } catch (err) {
                console.log(`   ❌ Lỗi tải:`, err.message);
            }
            await delay(1000); // Né block IP
        }
        console.log(`🎉 QUÉT HOÀN TẤT! Đã thêm ${addedCount} phim mới vào hệ thống.`);
    } catch (error) {
        console.log("❌ Lỗi hệ thống:", error);
    }
}

// -----------------------------------------------------
// TRUNG TÂM ĐIỀU KHIỂN HẸN GIỜ (CRON JOB)
// -----------------------------------------------------

console.log("🤖 Trợ lý săn phim tự động ĐÃ ĐƯỢC KÍCH HOẠT!");
console.log("⏳ Lịch trình: Cứ mỗi 4 tiếng sẽ tự động đi quét phim 1 lần (0h, 4h, 8h, 12h, 16h, 20h)...");

// Cú pháp '0 */4 * * *' nghĩa là chạy vào phút thứ 0, mỗi 4 tiếng 1 lần
cron.schedule('0 */4 * * *', async () => {
    let time = new Date().toLocaleString('vi-VN');
    console.log(`\n⏰ [${time}] Đến giờ đi tuần tra! Kích hoạt máy quét...`);
    await fetchNewMovies();
});