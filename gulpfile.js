var gulp = require('gulp');
var react = require('gulp-react');

var sass = require('gulp-sass');
var autoprefixer = require('gulp-autoprefixer');
var source = require('vinyl-source-stream');
// var connect = require('gulp-connect');
var reactify = require('reactify');
var browserify = require('browserify');
var watchify = require('watchify');
var uglify = require('gulp-uglify');
var shell = require('gulp-shell');

gulp.task('run-server', ['client/lib', 'client/style'], shell.task(['python3 server.py'], verbose=true));

gulp.task('default', ['package']);

gulp.task('package', function () {
    return gulp.src('lib/**/*.js*')
        .pipe(react())
        .pipe(gulp.dest('pkg'));
});

gulp.task('client/lib', ['default'], function () {
    var bundler = watchify(browserify({
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

gulp.task('client/style', ['default'], function () {
    return gulp.src('client/main.scss')
        .pipe(sass({errLogToConsole: true, outputStyle: 'compressed'}))
        .pipe(autoprefixer())
        .pipe(gulp.dest('client/static/css'));
        // .pipe(connect.reload());
});