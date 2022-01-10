const gulp = require('gulp');
const browserSync = require('browser-sync');
const rimraf = require('rimraf');
const glob = require('glob');
const browserify = require('browserify');
const source = require('vinyl-source-stream');
const cache = require('gulp-cached');
const gulpif = require('gulp-if');
const sourcemaps = require('gulp-sourcemaps');
const plumber = require('gulp-plumber');
const sassGlob = require("gulp-sass-glob");
const sass = require('gulp-sass')(require('sass'));
const postcss = require('gulp-postcss');
const autoprefixer = require('autoprefixer');
const cssnext = require('postcss-cssnext');
const ejs = require('gulp-ejs');
const rename = require('gulp-rename');
const htmlmin = require('gulp-html-minifier');
const imagemin = require('gulp-imagemin');
const pngquant = require('imagemin-pngquant');
const mozjpeg  = require('imagemin-mozjpeg');


// 開発・納品判別
let isProduction = false;

const src = './src/'; //開発フォルダ
let dist = './dev/'; //開発出力フォルダ

//対象ディレクトリ削除
gulp.task('production', (cb) => {
  isProduction = true;
  dist = './dist/'; //納品用フォルダ
  cb();
});


// ローカルサーバー設定
gulp.task('browser-sync',(cb) => {
  browserSync({
		server: {
			baseDir: dist
		},
    startPath: './',
    open: 'external',
    port: 8000,
    notify: false
	});
  cb();
});
// ホットリロード
gulp.task('bs-reload',(cb) => {
	browserSync.reload();
  cb();
});

//対象ディレクトリ削除
gulp.task('clean', (cb) => {
  if(isProduction) {
    rimraf(dist, cb);
  } else {
    cb();
  }
});

//tsコンパイル
gulp.task('ts',(cb) => {

  const files = glob.sync(
    src+'_ts/**/*.ts',
    {
      ignore: [
        src+'_ts/libs/*.ts',
        src+'_ts/_**/*.ts',
      ]
    }
  );

  files.forEach((file) => {
    browserify({
      entries: file
    }).plugin('tsify')
      .bundle()
      .pipe(source(file.replace(src + '_ts/', '').replace('.ts', '.js')))
      .pipe(gulp.dest(dist + 'js/'));
  })

  //libsフォルダ内はトランスパイルしない
  gulp.src(src+'js/libs/*.js')
    .pipe(cache('js-cache')) // jsをキャッシュさせつつ、
    .pipe(gulp.dest(dist+'js/libs/'))
  cb();
});


//ejsコンパイル
gulp.task('html',(cb) => {

    gulp.src([src+'**/*.ejs','!'+src+'_**/*.ejs','!'+src+'_**/**','!'+src+'_**','!'+src+'js/_**'])
      .pipe(plumber())
      .pipe(ejs({}, {}))
      .pipe(rename({extname: '.html'}))
      .pipe(gulpif(!isProduction, htmlmin({collapseWhitespace: true, removeComments: false})))
      .pipe(gulpif(isProduction, htmlmin({collapseWhitespace: true, removeComments: true})))
      //.pipe(htmlbeautify({indentSize: 1}))
      .pipe(gulp.dest(dist));

    cb();
  });

// Sassコンパイル
gulp.task('css',(cb) => {
  gulp.src([src + "_scss/*.scss", src + "_scss/**/*.scss"])
		.pipe(gulpif(!isProduction, sourcemaps.init()))
		.pipe(plumber())
		.pipe(sassGlob())
		.pipe(gulpif(!isProduction, sass({ outputStyle: "expanded" }).on("error", sass.logError)))
		.pipe(gulpif(isProduction, sass({ outputStyle: "compressed" }).on("error", sass.logError)))
		.pipe(
			postcss([
				autoprefixer({
					grid: true,
				}),
				cssnext({
					browsers: ["last 2 version", "ie >= 11", "iOS >= 10", "Android >= 6"],
					warnForDuplicates: false,
				}),
			])
		)
		.pipe(gulpif(!isProduction, sourcemaps.write()))
		.pipe(gulp.dest(dist + "css/"))
  cb();
});

// 画像圧縮
gulp.task('imgmin',(cb) => {
  gulp.src([src + "**/*.?(png|jpg|gif|svg|pdf)", src + "images/**/*.?(png|jpg|gif|svg|pdf)"])
    .pipe(
        gulpif(
            isProduction,
            imagemin([
                // 画像の圧縮
                pngquant({ quality: [0.85, 0.9], speed: 1 }), // pngの圧縮率設定
                mozjpeg({ quality: 90 }), // jpgの圧縮率設定
                //imagemin.svgo(),                            // svgの圧縮
                imagemin.gifsicle(), // gifの圧縮
            ])
        )
    )
    .pipe(gulp.dest(dist + ""))
        cb();
});



// 出力フォルダに移動
gulp.task('dist',(cb) => {
  gulp.src([
    src+'**/',
    src+'**/**',
    '!'+src+'_**',
    '!'+src+'_**/**',
    '!'+src+'**/_**',
    '!'+src+'_**',
    '!'+src+'_**/**',
    '!'+src+'**/_**',
    '!'+src+'images',
    '!'+src+'images/**',
    '!'+src+'**/**/*.?(ejs|js|scss|png|jpg|gif|svg)'
  ]).pipe(gulp.dest(dist));

  cb();
});



// 出力用タスク
gulp.task('default', gulp.series('clean','ts','css','html','imgmin','dist','browser-sync',(cb) => {
  gulp.watch([src+'**/*.ts'],gulp.parallel(['ts'])); // jsに変更があったら実行。
  gulp.watch([src+'**/*.scss'],gulp.parallel(['css'])); // cssに変更があったら実行。
  gulp.watch([src+'**/*.ejs'],gulp.parallel(['html'])); // htmlに変更があったら実行。
  gulp.watch([src+'**/*.?(png|jpg|gif|svg)'],gulp.parallel(['imgmin'])); // 画像に変更があったら実行。
  gulp.watch([src+'**/**'],gulp.series(['dist','bs-reload'])); // 変更があったら実行。
  cb();
}));


// 納品用タスク
gulp.task("build", gulp.series("production", "clean", "css", "html", "ts", "imgmin", "dist", (cb) => {
  gulp.watch([src + "**/*.ts"], gulp.parallel(["ts"])); // jsに変更があったら実行。
  gulp.watch([src + "**/*.scss"], gulp.parallel(["css"])); // cssに変更があったら実行。
  gulp.watch([src + "**/*.ejs"], gulp.parallel(["html"])); // ejsに変更があったら実行。
  cb();
}));
