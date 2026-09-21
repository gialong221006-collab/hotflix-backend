const sql = require('mssql/msnodesqlv8');

const sqlConfig = {
    connectionString: 'Driver={SQL Server};Server=.\\SQLEXPRESS;Database=HotflixDB;Trusted_Connection=yes;'
};

// Hàm tạm dừng để né hệ thống phòng thủ DDoS của API
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function updateMoviesData() {
    try {
        console.log("🚀 Bắt đầu chiến dịch cập nhật dữ liệu chi tiết chuyên sâu...");
        let pool = await sql.connect(sqlConfig);
        
        // Lấy danh sách toàn bộ phim đang bị trống cột country
        let result = await pool.request().query("SELECT id, name, slug FROM Movies WHERE country IS NULL OR lang IS NULL");
        let movies = result.recordset;
        let total = movies.length;
        
        console.log(`📌 Tìm thấy ${total} bộ phim cần cập nhật. Bắt đầu xử lý...\n`);

        for (let i = 0; i < total; i++) {
            let movie = movies[i];
            
            try {
                let response = await fetch(`https://phimapi.com/phim/${movie.slug}`);
                let data = await response.json();

                if (data.status && data.movie) {
                    let detail = data.movie;
                    let type = detail.type || null;
                    let genres = detail.category ? detail.category.map(c => c.name).join(', ') : null;
                  let countries = detail.country ? detail.country.map(c => c.name).join(', ') : null;
                    let lang = detail.lang || 'Vietsub'; // Lấy thông tin âm thanh từ PhimAPI

                    // Cập nhật lại request
                    let request = pool.request();
                    request.input('type', sql.NVarChar, type);
                    request.input('genre', sql.NVarChar, genres);
                    request.input('country', sql.NVarChar, countries);
                    request.input('lang', sql.NVarChar, lang); // <-- Thêm dòng này
                    request.input('id', sql.Int, movie.id);

                    await request.query(`
                        UPDATE Movies 
                        SET type = @type, genre = @genre, country = @country, lang = @lang 
                        WHERE id = @id
                    `);

                    console.log(`✅ [${i + 1}/${total}] Đã cập nhật: ${movie.name} (${countries})`);
                } else {
                    console.log(`⚠️ [${i + 1}/${total}] Bỏ qua: ${movie.name} (API trống)`);
                }
            } catch (err) {
                console.log(`❌ [${i + 1}/${total}] Lỗi mạng tại: ${movie.name} -> Đang chạy tiếp...`);
            }

            // Tạm nghỉ 1 giây trước khi cào phim tiếp theo
            await delay(1000);
        }

        console.log("\n🎉 HOÀN TẤT CẬP NHẬT TOÀN BỘ KHO DỮ LIỆU!");
        process.exit(0);
    } catch (error) {
        console.log("❌ Lỗi kết nối CSDL:", error);
    }
}

updateMoviesData();