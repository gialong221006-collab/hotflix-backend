const axios = require('axios');
const sql = require('mssql/msnodesqlv8');

// Hàm tạo độ trễ (Sleep) để giả lập thời gian nghỉ giữa các lần gọi API
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Cấu hình Connection String trực tiếp
const sqlConfig = {
    connectionString: 'Driver={SQL Server};Server=.\\SQLEXPRESS;Database=HotflixDB;Trusted_Connection=yes;'
};

async function crawlAllMovies() {
    try {
        console.log("Đang kết nối vào cơ sở dữ liệu HotflixDB...");
        let pool = await sql.connect(sqlConfig);
        console.log("✅ Kết nối SQL thành công!\n");

        // Mỗi trang API thường có 24 phim. Cào 420 trang sẽ thu về khoảng 10.080 phim.
        const totalPages = 420; 

        for (let page = 1; page <= totalPages; page++) {
            console.log(`\n===========================================`);
            console.log(`⏳ Đang kéo dữ liệu từ Trang ${page}/${totalPages}...`);
            
            try {
                // Gọi API lấy dữ liệu theo số trang hiện tại
                const response = await axios.get(`https://phimapi.com/danh-sach/phim-moi-cap-nhat?page=${page}`);
                const movies = response.data.items;
                
                if (!movies || movies.length === 0) {
                    console.log("⚠️ Không còn dữ liệu mới, dừng Bot.");
                    break;
                }

                console.log(`Tiến hành quét và lưu ${movies.length} bộ phim...`);

                for (let i = 0; i < movies.length; i++) {
                    let movie = movies[i];
                    
                    // 1. Kiểm tra phim đã có trong ổ cứng chưa
                    let checkExist = await pool.request()
                        .input('slug', sql.VarChar, movie.slug)
                        .query('SELECT id FROM Movies WHERE slug = @slug');

                    if (checkExist.recordset.length === 0) {
                        // 2. Chèn dữ liệu nếu phim chưa tồn tại
                        await pool.request()
                            .input('slug', sql.VarChar, movie.slug)
                            .input('name', sql.NVarChar, movie.name)
                            .input('origin_name', sql.NVarChar, movie.origin_name)
                            .input('thumb_url', sql.VarChar, movie.thumb_url)
                            .input('year', sql.Int, movie.year)
                            .query(`
                                INSERT INTO Movies (slug, name, origin_name, thumb_url, year)
                                VALUES (@slug, @name, @origin_name, @thumb_url, @year)
                            `);
                        console.log(`  + Đã lưu mới: ${movie.name}`);
                    } else {
                        console.log(`  - Đã có sẵn: ${movie.name}`);
                    }
                }

                // 3. Nhịp thở cho Bot: Nghỉ ngơi 2 giây trước khi lật trang
                console.log(`\n💤 Xong trang ${page}. Tạm nghỉ 2 giây để né hệ thống phòng thủ DDoS...`);
                await sleep(2000);

            } catch (pageError) {
                console.log(`❌ CÓ LỖI TẠI TRANG ${page}:`, pageError.message);
                console.log("Bỏ qua trang này. Chờ 5 giây để hồi phục mạng rồi đi tiếp...");
                await sleep(5000); // Nghỉ lâu hơn nếu gặp lỗi mạng
            }
        }

        console.log("\n🎉 HOÀN TẤT CHIẾN DỊCH CÀO 10.000 PHIM!");
        process.exit(0);

    } catch (error) {
        console.log("❌ LỖI KHỞI ĐỘNG BOT:", error);
    }
}

crawlAllMovies();