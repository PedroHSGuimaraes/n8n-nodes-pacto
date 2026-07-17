const path = require('path');
const { task, src, dest } = require('gulp');

task('build:icons', copyIcons);

function copyIcons() {
	const nodeSource = path.resolve('nodes', '**', '*.{png,svg}');
	const nodeDestination = path.resolve('dist', 'nodes');
	src(nodeSource, { base: 'nodes' }).pipe(dest(nodeDestination));

	const credentialSource = path.resolve('credentials', '**', '*.{png,svg}');
	const credentialDestination = path.resolve('dist', 'credentials');
	return src(credentialSource, { base: 'credentials' }).pipe(dest(credentialDestination));
}
