import Product from '../../models/product.model.js'
import { priceNew } from '../../helpers/product.js'
import { searchProducts } from '../../helpers/fuzzySearch.js'


// [GET] /
export async function index(req, res) {
    try {
        const keyword = req.query.keyword;

        let newProducts = [];
        let searchType = 'none';
        let totalFound = 0;
        
        if (keyword) {
            // Lấy tất cả products active
            const allProducts = await Product.find({
                deleted: false,
                status: 'active'
            });

            const fuzzyResult = searchProducts(allProducts, keyword);
            
            if (fuzzyResult.results.length > 0) {
                newProducts = priceNew(fuzzyResult.results);
                searchType = 'fuzzy';
                totalFound = fuzzyResult.totalFound;
            } else {
                // Fallback to regex search
                const keywordRegex = new RegExp(keyword, 'i');
                const products = await Product.find({
                    deleted: false,
                    status: 'active',
                    title: keywordRegex
                });
                
                newProducts = priceNew(products);
                searchType = 'regex';
                totalFound = products.length;
            }
        }

        res.render('client/pages/search/index', {
            title: 'Kết quả tìm kiếm',
            products: newProducts,
            keyword: keyword,
            searchType: searchType,
            totalFound: totalFound
        });
    } catch (error) {
        console.error('Error in search:', error);
        res.status(500).render('client/pages/error/500', {
            title: 'Lỗi tìm kiếm'
        });
    }
}
