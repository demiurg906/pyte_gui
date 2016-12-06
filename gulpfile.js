const gulp = require('gulp');
const react = require('gulp-react');

const sass = require('gulp-sass');
const autoprefixer = require('gulp-autoprefixer');
const source = require('vinyl-source-stream');
// var connect = require('gulp-connect');
const reactify = require('reactify');
const browserify = require('browserify');
const watchify = require('watchify');
const uglify = require('gulp-uglify');
const shell = require('gulp-shell');
const postcss = require('gulp-postcss');

gulp.task('run-server', ['client/lib', 'client/style'],
    shell.task(['python3 server.py'], verbose=true));

gulp.task('default', ['run-server']);

gulp.task('package', function () {
    return gulp.src('lib/**/*.js*')
        .pipe(react())
        .pipe(gulp.dest('pkg'));
});

gulp.task('client/lib', ['package'], function () {
    const bundler = watchify(browserify({
        cache: {},
        packageCache: {},
        fullPaths: true,
        extensions: '.jsx'
    }));

    bundler.add('./client/app.jsx');
    bundler.transform(reactify);
    bundler.on('update', rebundle);

    function rebundle () {
        console.log('rebundling');
        return bundler.bundle()
            .on('error', function (err) {
                console.log(err.message);
            })
            .pipe(source('app.js'))
            .pipe(gulp.dest('./client/static/js'))
            // .pipe(connect.reload())
        ;
    }

    return rebundle();
});

gulp.task('client/style', ['package'], function () {
    return gulp.src('client/*.scss')
        .pipe(sass({errLogToConsole: true, outputStyle: 'compressed'}))
        // .pipe(autoprefixer())
        .pipe(postcss([autoprefixer]))
        .pipe(gulp.dest('client/static/css'));
        // .pipe(connect.reload());
});